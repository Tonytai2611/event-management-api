import mongoose from 'mongoose';
import Event from '../models/Event.js';
import User from '../models/User.js';
import connectDB from '../config/db.js';
import dotenv from 'dotenv';

dotenv.config();

const createSampleEvents = async () => {
    try {
        // Kết nối database
        await connectDB();
        console.log('🔗 Connected to database');

        // Tìm user "minh_khoi"
        const organizer = await User.findOne({ username: 'minh_khoi' });
        if (!organizer) {
            console.log('❌ User "minh_khoi" not found. Available users:');
            const allUsers = await User.find({}, 'username email');
            allUsers.forEach(user => {
                console.log(`   - ${user.username} (${user.email})`);
            });
            process.exit(1);
        }

        console.log(`👤 Found organizer: ${organizer.username} (${organizer.email})`);

        // Xóa TẤT CẢ events cũ
        const deletedEvents = await Event.deleteMany({});
        console.log(`🗑️ Deleted ${deletedEvents.deletedCount} existing events`);

        const events = [];
        const today = new Date();
        
        // Danh sách mẫu events cho minh_khoi
        const eventTemplates = [
            {
                title: "Tech Innovation Conference 2024",
                description: "Join industry leaders as they discuss the latest trends in technology, AI, and digital transformation. Network with professionals and gain insights into the future of tech.",
                summary: "Annual tech conference featuring AI, blockchain, and emerging technologies",
                eventType: "tech",
                location: "Tech Center, Ho Chi Minh City",
                maxAttendees: 200
            },
            {
                title: "Business Leadership Summit",
                description: "A comprehensive summit for business leaders to share strategies, learn from experts, and build valuable connections in the corporate world.",
                summary: "Leadership development and business strategy summit",
                eventType: "business", 
                location: "Bitexco Financial Tower, District 1",
                maxAttendees: 150
            },
            {
                title: "Gaming Championship Tournament",
                description: "Competitive gaming tournament featuring popular esports titles. Prizes, streaming, and community engagement for gamers of all levels.",
                summary: "Esports tournament with cash prizes and community activities",
                eventType: "game",
                location: "Saigon Exhibition & Convention Center",
                maxAttendees: 300
            },
            {
                title: "Music Festival Vietnam 2024",
                description: "Multi-genre music festival featuring local and international artists. Food trucks, merchandise, and unforgettable performances.",
                summary: "Outdoor music festival with multiple stages and artists",
                eventType: "music",
                location: "Thong Nhat Park, Ho Chi Minh City",
                maxAttendees: 500
            },
            {
                title: "Sports & Wellness Expo",
                description: "Explore fitness equipment, wellness products, and participate in sports demonstrations. Health screenings and nutrition workshops included.",
                summary: "Health and wellness expo with fitness demonstrations",
                eventType: "sports",
                location: "Phu Tho Stadium Complex",
                maxAttendees: 250
            },
            {
                title: "Startup Pitch Competition HCM",
                description: "Emerging startups present their innovative ideas to investors and industry experts. Networking opportunities and mentorship sessions available.",
                summary: "Entrepreneurship competition with investor panel",
                eventType: "business",
                location: "Dreamplex Coworking Space",
                maxAttendees: 100
            },
            {
                title: "Coding Bootcamp Workshop",
                description: "Intensive hands-on workshop covering modern web development technologies. Perfect for beginners and intermediate developers.",
                summary: "Web development workshop for programmers",
                eventType: "tech",
                location: "FPT University Campus",
                maxAttendees: 50
            },
            {
                title: "Board Game Convention Vietnam",
                description: "Discover new board games, participate in tournaments, and meet fellow gaming enthusiasts. Game designers and publishers present latest releases.",
                summary: "Board game expo with tournaments and new releases",
                eventType: "game",
                location: "Diamond Plaza Convention Hall",
                maxAttendees: 400
            },
            {
                title: "Jazz Night Live at Saigon",
                description: "Intimate jazz performance featuring renowned Vietnamese and international musicians. Wine tasting and gourmet appetizers in an elegant venue setting.",
                summary: "Jazz music performance with wine and dining",
                eventType: "music",
                location: "Saigon Opera House",
                maxAttendees: 80
            },
            {
                title: "Ho Chi Minh City Marathon Training",
                description: "Professional coaching, nutrition guidance, and training plans for marathon preparation. Suitable for all fitness levels.",
                summary: "Marathon preparation with professional coaching",
                eventType: "sports",
                location: "Le Van Tam Park",
                maxAttendees: 75
            },
            {
                title: "AI & Machine Learning Workshop",
                description: "Hands-on workshop exploring artificial intelligence and machine learning applications. Real-world projects and expert guidance included.",
                summary: "AI/ML workshop with practical projects",
                eventType: "tech",
                location: "RMIT University Vietnam",
                maxAttendees: 60
            },
            {
                title: "Digital Marketing Masterclass",
                description: "Learn advanced digital marketing strategies, social media optimization, and data analytics from industry experts.",
                summary: "Digital marketing training for professionals",
                eventType: "business",
                location: "Lotte Center Hanoi",
                maxAttendees: 120
            },
            {
                title: "Food & Culture Festival",
                description: "Explore Vietnamese cuisine and cultural traditions. Cooking demonstrations, traditional performances, and artisan showcases.",
                summary: "Vietnamese food and culture celebration",
                eventType: "music", // Categorized as cultural event
                location: "Ben Thanh Market Square",
                maxAttendees: 600
            },
            {
                title: "Basketball Tournament 2024",
                description: "Inter-city basketball competition featuring teams from across Vietnam. Professional referees and live streaming included.",
                summary: "Basketball championship with multiple teams",
                eventType: "sports",
                location: "Tan Binh Sports Center",
                maxAttendees: 200
            },
            {
                title: "Mobile Game Development Workshop",
                description: "Learn to create mobile games using Unity and modern development tools. Perfect for aspiring game developers.",
                summary: "Mobile game development using Unity",
                eventType: "game",
                location: "Game Development Studio",
                maxAttendees: 40
            }
        ];

        // Tạo events cho các ngày khác nhau
        for (let i = 0; i < eventTemplates.length; i++) {
            const template = eventTemplates[i];
            
            // Tạo ngày bắt đầu (từ ngày mai đến 60 ngày tới)
            const startDate = new Date(today);
            startDate.setDate(today.getDate() + Math.floor(Math.random() * 60) + 1);
            
            // Tạo ngày kết thúc (1-3 ngày sau startDate)
            const endDate = new Date(startDate);
            const duration = Math.floor(Math.random() * 3) + 1; // 1-3 ngày
            endDate.setDate(startDate.getDate() + duration - 1);
            
            // Tạo thời gian ngẫu nhiên
            const startHour = 8 + Math.floor(Math.random() * 6); // 8AM-2PM
            const endHour = startHour + 2 + Math.floor(Math.random() * 6); // 2-8 tiếng sau
            
            const event = {
                title: template.title,
                description: template.description,
                summary: template.summary,
                startTime: `${startHour.toString().padStart(2, '0')}:00`,
                endTime: `${Math.min(endHour, 23).toString().padStart(2, '0')}:00`,
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0],
                location: template.location,
                eventType: template.eventType,
                image: `https://picsum.photos/400/300?random=${i + 200}`, // Random placeholder images
                maxAttendees: template.maxAttendees,
                publicity: Math.random() > 0.1, // 90% public events
                organizer: organizer._id,
                status: 'scheduled',
                attendees: [], // Bắt đầu với 0 attendees
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            events.push(event);
        }

        // Insert events vào database
        const createdEvents = await Event.insertMany(events);
        console.log(`✅ Successfully created ${createdEvents.length} sample events for ${organizer.username}`);

        // Hiển thị summary
        console.log('\n📋 Created Events Summary:');
        createdEvents.forEach((event, index) => {
            console.log(`${index + 1}. ${event.title}`);
            console.log(`   📅 ${event.startDate} ${event.startTime} - ${event.endDate} ${event.endTime}`);
            console.log(`   📍 ${event.location}`);
            console.log(`   🏷️ Type: ${event.eventType}`);
            console.log(`   👥 Max: ${event.maxAttendees} attendees`);
            console.log(`   🌐 Public: ${event.publicity ? 'Yes' : 'No'}`);
            console.log('');
        });

        console.log('🎉 All events created successfully for minh_khoi!');
        console.log(`📊 Total: ${createdEvents.length} events spanning 60 days`);
        
        // Đóng database connection
        await mongoose.connection.close();
        console.log('🔌 Database connection closed');
        
        process.exit(0);

    } catch (error) {
        console.error('❌ Error creating sample events:', error);
        process.exit(1);
    }
};

// Chạy script
createSampleEvents();