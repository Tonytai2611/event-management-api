import Event from '../models/Event.js';
import Participation from '../models/Participation.js';
import Notification from '../models/Notification.js';
import { logActivity } from '../middleware/logActivity.js';
import Settings from '../models/Settings.js';
import { uploadToS3, getSignedUrlForKey, deleteFromS3 } from '../utils/s3Helper.js';
import { detectEventChanges } from '../utils/eventHelpers.js';
import fs from 'fs';
import https from 'https';
import mongoose from 'mongoose';

const storageType = process.env.STORAGE_TYPE || 'cloudinary';

// Helper function to upload to Cloudinary
const uploadToCloudinary = async (file) => {
  const fileBuffer = fs.readFileSync(file.path);
  const base64File = fileBuffer.toString('base64');
  const dataURI = `data:${file.mimetype};base64,${base64File}`;

  const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/upload`;

  const boundary = '----WebKitFormBoundary' + Math.random().toString(16).slice(2);
  const payload = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"',
    `Content-Type: ${file.mimetype}`,
    '',
    dataURI,
    `--${boundary}`,
    'Content-Disposition: form-data; name="upload_preset"',
    '',
    process.env.CLOUDINARY_UPLOAD_PRESET,
    `--${boundary}--`,
    ''
  ].join('\r\n');

  const response = await new Promise((resolve, reject) => {
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(cloudinaryUrl, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve(JSON.parse(data));
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(payload);
    req.end();
  });

  return response.secure_url;
};

// Helper function to delete old image
const deleteOldImage = async (imageKey) => {
  if (!imageKey) return;
  
  if (storageType === 's3') {
    await deleteFromS3(imageKey);
  }
};

// Helper to add signed URLs to events
const addSignedUrlsToEvents = async (events) => {
  if (storageType !== 's3') return events;

  const eventsArray = Array.isArray(events) ? events : [events];
  
  for (const event of eventsArray) {
    if (event.image) {
      event.imageUrl = await getSignedUrlForKey(event.image);
    }
  }
  
  return events;
};

// GET /events
export const getAllEvent = async (req, res) => {
  try {
    const { public: isPublic, organizerId, participantId } = req.query;

    const filter = { status: { $ne: 'deleted' }}; 
    
    if (isPublic){
      filter.publicity = true;
      filter.status = { $nin: ['ended', 'cancelled', 'ongoing', 'deleted'] };
    } 

    if (organizerId) filter.organizer = organizerId;
    let events = await Event.find(filter).populate('organizer').sort({ createdAt: -1 });

    if (participantId) {
      const participations = await Participation.find({
        user: participantId,
        status: 'approved'
      }).select('event');

      const participantEventIds = participations.map(p => p.event);
      let joinedEvents = await Event.find({ _id: { $in: participantEventIds } })
        .populate('organizer')
        .sort({ createdAt: -1 });

      // Add signed URLs
      joinedEvents = await addSignedUrlsToEvents(joinedEvents);

      if (organizerId) {
        events = await addSignedUrlsToEvents(events);
        const allEvents = [...events, ...joinedEvents];
        return res.status(200).json(allEvents);
      } else {
        return res.status(200).json(joinedEvents);
      }
    }

    // Add signed URLs for all events
    events = await addSignedUrlsToEvents(events);
    return res.status(200).json(events);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch events', message: err.message });
  }
};

// GET /events/:eventId
export const getEvent = async (req, res) => {
  try {
    let event = await Event.findById(req.params.eventId).populate('organizer');
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Add signed URL
    event = await addSignedUrlsToEvents(event);
    res.status(200).json(event);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch event', message: err.message });
  }
};

// POST /events
export const createEvent = async (req, res) => {
  try {
    let imageKey = null;

    if (req.file) {
      if (storageType === 's3') {
        // Upload to S3 using buffer
        imageKey = await uploadToS3(req.file.buffer, req.file.mimetype);
        console.log('✅ Uploaded to S3:', imageKey);
      } else {
        // Upload to Cloudinary
        imageKey = await uploadToCloudinary(req.file);
        fs.unlinkSync(req.file.path);
        console.log('✅ Uploaded to Cloudinary:', imageKey);
      }
    }
    
    const settings = await Settings.findOne();
    if (!settings || !settings.eventSettings) {
      return res.status(500).json({ error: 'Event settings not configured' });
    }
    const maxAllowed = settings.eventSettings.maxAttendeesPerEvent;
    if (req.body.maxAttendees && req.body.maxAttendees > maxAllowed) {
      return res.status(500).json({
        message: `Maximum capacity exceeded. System limit: ${maxAllowed}`
      });
    }

    const newEvent = new Event({
      ...req.body,
      organizer: req.userId,
      maxAttendees: req.body.maxAttendees || maxAllowed,
      image: imageKey 
    });

    await newEvent.save();

    await logActivity(
      req.userId,
      'created',
      'event',
      newEvent._id,
      { eventTitle: newEvent.title }
    );

    let populatedEvent = await Event.findById(newEvent._id).populate('organizer');
    
    // Add signed URL for response
    populatedEvent = await addSignedUrlsToEvents(populatedEvent);
    
    res.status(201).json(populatedEvent);

  } catch (err) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(400).json({
      error: 'Failed to create event',
      message: err.message
    });
  }
};

// PUT /events/:eventId
export const updateEvent = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let imageKey = null;

    const existingEvent = await Event.findById(req.params.eventId).session(session).populate('organizer');
    if (!existingEvent) {
      await session.abortTransaction();
      return res.status(404).json({ error: 'Event not found' });
    }

    if (req.file) {
      if (storageType === 's3') {
        imageKey = await uploadToS3(req.file.buffer, req.file.mimetype);
        console.log('✅ Uploaded to S3:', imageKey);
      } else {
        imageKey = await uploadToCloudinary(req.file);
        fs.unlinkSync(req.file.path);
        console.log('✅ Uploaded to Cloudinary:', imageKey);
      }

      // Delete old image
      if (existingEvent.image) {
        await deleteOldImage(existingEvent.image);
      }
    }

    const organizerId = existingEvent.organizer._id;

    const updateData = {
      ...req.body,
      image: imageKey || existingEvent.image,
    };

    const settings = await Settings.findOne();
    if (!settings || !settings.eventSettings) {
      await session.abortTransaction();
      return res.status(500).json({ error: 'Event settings not configured' });
    }
    const maxAllowed = settings.eventSettings.maxAttendeesPerEvent;
    if (updateData.maxAttendees && updateData.maxAttendees > maxAllowed) {
      await session.abortTransaction();
      return res.status(400).json({
        message: `System limit exceeded. Current maximum event capacity: ${maxAllowed}`
      });
    }

    const changes = detectEventChanges(existingEvent, updateData);

    let updatedEvent = await Event.findByIdAndUpdate(req.params.eventId, updateData, {
      new: true,
      runValidators: true,
      session,
    }).populate('organizer');

    await logActivity(
      req.userId,
      'updated',
      'event',
      updatedEvent._id || updatedEvent.id,
      { eventTitle: updatedEvent.title }
    );

    if (changes) {
      const participations = await Participation.find({
        event: req.params.eventId,
        status: 'approved'
      }).session(session);

      if (participations.length > 0) {
        const notifications = participations.map(participation => {
          return {
            userId: participation.user,
            type: 'eventUpdate',
            message: `Event "${updatedEvent.title}" has been updated`,
            relatedId: participation._id,
            notificationSender: organizerId,
            data: {
              message: `The event "${updatedEvent.title}" has been updated. Please kindly check the new details.
              We look forward to your participation.
                
              Regards,
                
              ${updatedEvent.organizer.firstName} ${updatedEvent.organizer.lastName},
              ${updatedEvent.organizer.email}`
            },
            isRead: false,
          };
        });

        await Notification.create(notifications, { session, ordered: true });
      }
    }

    await session.commitTransaction();
    
    // Add signed URL for response
    updatedEvent = await addSignedUrlsToEvents(updatedEvent);
    
    res.status(200).json(updatedEvent);
  } catch (err) {
    await session.abortTransaction();
    console.error('Error updating event:', err);

    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(400).json({
      error: 'Failed to update event',
      message: err.message
    });
  } finally {
    session.endSession();
  }
};

// DELETE /events/:eventId
export const deleteEvent = async (req, res) => {
  try {
    const deletedEvent = await Event.findByIdAndUpdate(
      req.params.eventId,
      { status: 'deleted' },
      { new: true }
    );

    if (!deletedEvent) {
      return res.status(404).json({ error: 'Event not found' });
    }

    await Participation.updateMany(
      { event: deletedEvent._id },
      { status: 'deleted' }
    );

    if (deletedEvent.image) {
      await deleteOldImage(deletedEvent.image);
    }
    
    await logActivity(
      req.userId,
      'deleted',
      'event',
      deletedEvent._id,
      { eventTitle: deletedEvent.title }
    );

    res.status(200).json({ message: 'Event and related participations soft deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete event', message: err.message });
  }
};
