import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create a transport for Nodemailer
const createTransporter = () => {
  console.log('Creating nodemailer transporter with config:', {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD ? '********' : 'not set' // Masking password for security
  });
  
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
    debug: true // Turn on debug mode
  });
};

// Send verification code to user email
const sendVerificationCode = async (user, verificationCode) => {
  try {
    console.log(`Attempting to send verification email to ${user.email} with code: ${verificationCode}`);
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
      to: user.email,
      subject: 'Email Verification - Event Planning App',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e9e9e9; border-radius: 5px;">
          <h2 style="color: #569DBA; text-align: center;">Email Verification</h2>
          <p>Hello ${user.firstName} ${user.lastName},</p>
          <p>Thank you for registering with our Event Planning App. Please use the verification code below to complete your registration:</p>
          <div style="background-color: #f7f7f7; padding: 15px; text-align: center; margin: 20px 0;">
            <h1 style="letter-spacing: 5px; font-size: 32px; margin: 0; color: #333;">${verificationCode}</h1>
          </div>
          <p>This code will expire in 24 hours.</p>
          <p>If you didn't request this code, you can safely ignore this email.</p>
          <p>Best regards,<br>The Event Planning Team</p>
        </div>
      `
    };
    
    console.log('Sending email with options:', {
      to: mailOptions.to,
      subject: mailOptions.subject,
      from: mailOptions.from
    });
    
    const info = await transporter.sendMail(mailOptions);
    
    console.log('Email sent successfully:', {
      messageId: info.messageId,
      response: info.response
    });
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending verification email:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    return { success: false, error };
  }
};

// Send welcome email after successful verification
const sendWelcomeEmail = async (user) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
      to: user.email,
      subject: 'Welcome to Event Planning App',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e9e9e9; border-radius: 5px;">
          <h2 style="color: #569DBA; text-align: center;">Welcome to Event Planning App!</h2>
          <p>Dear ${user.firstName} ${user.lastName},</p>
          <p>Thank you for verifying your email address. Your account is now fully active!</p>
          <p>You can now start creating and managing events, sending invitations, and much more.</p>
          <div style="text-align: center; margin: 25px 0;">
            <a href="${process.env.CLIENT_URL}/login" style="background-color: #569DBA; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Log in now
            </a>
          </div>
          <p>We're excited to have you on board!</p>
          <p>Best regards,<br>The Event Planning Team</p>
        </div>
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return { success: false, error };
  }
};

// Send event invitation email to user
const sendEventInvitationEmail = async (invitee, event, organizer) => {
  try {
    console.log(`Sending event invitation email to ${invitee.email} for event ${event.title}`);
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
      to: invitee.email,
      subject: `Invitation to Event: ${event.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e9e9e9; border-radius: 5px;">
          <h2 style="color: #569DBA; text-align: center;">Event Invitation</h2>
          <p>Hello ${invitee.firstName || invitee.username},</p>
          <p>${organizer.firstName || organizer.username} has invited you to attend the following event:</p>
          <div style="background-color: #f7f7f7; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <h3 style="color: #333; margin-top: 0;">${event.title}</h3>
            <p><strong>Date:</strong> ${event.startDate}</p>
            <p><strong>Time:</strong> ${event.startTime} to ${event.endTime || 'TBD'}</p>
            <p><strong>Location:</strong> ${event.location || 'TBD'}</p>
            ${event.summary ? `<p><strong>Description:</strong> ${event.summary}</p>` : ''}
          </div>
          <div style="text-align: center; margin: 25px 0;">
            <a href="${process.env.CLIENT_URL}/events/${event._id}" style="background-color: #569DBA; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              View Event Details
            </a>
          </div>
          <p>Please log in to your account to accept or decline this invitation.</p>
          <p>We hope to see you there!</p>
          <p>Best regards,<br>${organizer.firstName || organizer.username}<br>${organizer.email}</p>
        </div>
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('Event invitation email sent successfully:', {
      messageId: info.messageId,
      response: info.response
    });
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending event invitation email:', error);
    return { success: false, error };
  }
};

// Send invitation reminder email to users
const sendInvitationReminderEmail = async (user, event, organizer) => {
  try {
    console.log(`Sending invitation reminder email to ${user.email} for event ${event.title}`);
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
      to: user.email,
      subject: `Reminder: Invitation to ${event.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e9e9e9; border-radius: 5px;">
          <h2 style="color: #569DBA; text-align: center;">Event Invitation Reminder</h2>
          <p>Hello ${user.firstName || user.username},</p>
          <p>This is a reminder that you have been invited to attend the following event:</p>
          <div style="background-color: #f7f7f7; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <h3 style="color: #333; margin-top: 0;">${event.title}</h3>
            <p><strong>Date:</strong> ${event.startDate}</p>
            <p><strong>Time:</strong> ${event.startTime} to ${event.endTime || 'TBD'}</p>
            <p><strong>Location:</strong> ${event.location || 'TBD'}</p>
          </div>
          <p>We have sent an invitation to your account. Kindly check your notifications to confirm your attendance at your earliest convenience.</p>
          <div style="text-align: center; margin: 25px 0;">
            <a href="${process.env.CLIENT_URL}/login" style="background-color: #569DBA; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Respond to Invitation
            </a>
          </div>
          <p>We hope to welcome you at the event.</p>
          <p>Best regards,<br>${organizer.firstName} ${organizer.lastName}<br>${organizer.email}</p>
        </div>
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('Invitation reminder email sent successfully:', {
      messageId: info.messageId,
      response: info.response
    });
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending invitation reminder email:', error);
    return { success: false, error };
  }
};

// Send event reminder email to confirmed attendees
const sendEventReminderEmail = async (user, event, organizer) => {
  try {
    console.log(`Sending event reminder email to ${user.email} for event ${event.title}`);
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
      to: user.email,
      subject: `Reminder: Upcoming Event - ${event.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e9e9e9; border-radius: 5px;">
          <h2 style="color: #569DBA; text-align: center;">Event Reminder</h2>
          <p>Hello ${user.firstName || user.username},</p>
          <p>This is a friendly reminder that you are confirmed to attend the following event:</p>
          <div style="background-color: #f7f7f7; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <h3 style="color: #333; margin-top: 0;">${event.title}</h3>
            <p><strong>Date:</strong> ${event.startDate}</p>
            <p><strong>Time:</strong> ${event.startTime} to ${event.endTime || 'TBD'}</p>
            <p><strong>Location:</strong> ${event.location || 'TBD'}</p>
          </div>
          <div style="text-align: center; margin: 25px 0;">
            <a href="${process.env.CLIENT_URL}/events/${event._id}" style="background-color: #569DBA; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              View Event Details
            </a>
          </div>
          <p>We look forward to your participation!</p>
          <p>Best regards,<br>${organizer.firstName} ${organizer.lastName}<br>${organizer.email}</p>
        </div>
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('Event reminder email sent successfully:', {
      messageId: info.messageId,
      response: info.response
    });
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending event reminder email:', error);
    return { success: false, error };
  }
};

// Send email to organizer when someone requests to join an event
const sendJoinRequestEmail = async (organizer, event, requester) => {
  try {
    console.log(`Sending join request notification email to ${organizer.email} for event ${event.title}`);
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
      to: organizer.email,
      subject: `New Join Request for ${event.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e9e9e9; border-radius: 5px;">
          <h2 style="color: #569DBA; text-align: center;">New Join Request</h2>
          <p>Hello ${organizer.firstName || organizer.username},</p>
          <p><strong>${requester.firstName || requester.username}</strong> has requested to join your event:</p>
          <div style="background-color: #f7f7f7; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <h3 style="color: #333; margin-top: 0;">${event.title}</h3>
            <p><strong>Date:</strong> ${event.startDate}</p>
            <p><strong>Time:</strong> ${event.startTime} to ${event.endTime || 'TBD'}</p>
          </div>
          <div style="text-align: center; margin: 25px 0;">
            <a href="${process.env.CLIENT_URL}/events/${event._id}/manage" style="background-color: #569DBA; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Manage Join Requests
            </a>
          </div>
          <p>You can approve or decline this request from your event management page.</p>
          <p>Best regards,<br>The Event Planning Team</p>
        </div>
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('Join request email sent successfully:', {
      messageId: info.messageId,
      response: info.response
    });
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending join request email:', error);
    return { success: false, error };
  }
};

// Send email to user when their join request is processed
const sendJoinRequestResponseEmail = async (user, event, organizer, isApproved) => {
  try {
    console.log(`Sending join request ${isApproved ? 'approval' : 'rejection'} email to ${user.email} for event ${event.title}`);
    const transporter = createTransporter();
    
    const subject = isApproved 
      ? `Join Request Approved for ${event.title}`
      : `Join Request Declined for ${event.title}`;
    
    const content = isApproved
      ? `<p>Your request to join "${event.title}" has been <strong style="color: green;">approved</strong> by the organizer.</p>
         <p>You are now confirmed to attend this event on ${event.startDate} from ${event.startTime} to ${event.endTime || 'TBD'} at ${event.location || 'the specified location'}.</p>
         <p>We look forward to seeing you there!</p>`
      : `<p>We regret to inform you that your request to join "${event.title}" has been <strong style="color: #d9534f;">declined</strong> by the organizer.</p>
         <p>Please feel free to explore other events that might interest you.</p>`;
         
    const actionButton = isApproved
      ? `<a href="${process.env.CLIENT_URL}/events/${event._id}" style="background-color: #569DBA; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
           View Event Details
         </a>`
      : `<a href="${process.env.CLIENT_URL}/events" style="background-color: #569DBA; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
           Explore Events
         </a>`;
    
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
      to: user.email,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e9e9e9; border-radius: 5px;">
          <h2 style="color: #569DBA; text-align: center;">Join Request ${isApproved ? 'Approved' : 'Declined'}</h2>
          <p>Hello ${user.firstName || user.username},</p>
          ${content}
          <div style="background-color: #f7f7f7; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <h3 style="color: #333; margin-top: 0;">${event.title}</h3>
            <p><strong>Date:</strong> ${event.startDate}</p>
            <p><strong>Time:</strong> ${event.startTime} to ${event.endTime || 'TBD'}</p>
            <p><strong>Location:</strong> ${event.location || 'TBD'}</p>
          </div>
          <div style="text-align: center; margin: 25px 0;">
            ${actionButton}
          </div>
          <p>Regards,<br>${organizer.firstName} ${organizer.lastName}<br>${organizer.email}</p>
        </div>
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('Join request response email sent successfully:', {
      messageId: info.messageId,
      response: info.response
    });
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending join request response email:', error);
    return { success: false, error };
  }
};

export default {
  sendVerificationCode,
  sendWelcomeEmail,
  sendInvitationReminderEmail,
  sendEventReminderEmail,
  sendJoinRequestEmail,
  sendJoinRequestResponseEmail,
  sendEventInvitationEmail
};
