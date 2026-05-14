import dotenv from 'dotenv';
import { RoomServiceClient } from 'livekit-server-sdk';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../.env') });

async function testConnection() {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const url = process.env.LIVEKIT_URL;

    console.log('--- LiveKit Connection Test ---');
    console.log('URL:', url);
    console.log('API Key:', apiKey);
    
    if (!apiKey || !apiSecret || !url) {
        console.error('Error: Missing LiveKit environment variables.');
        process.exit(1);
    }

    // Convert wss:// to https:// for the RoomServiceClient
    const host = url.replace('wss://', 'https://').replace('ws://', 'http://');
    
    try {
        const roomService = new RoomServiceClient(host, apiKey, apiSecret);
        console.log('Testing connection by listing rooms...');
        
        const rooms = await roomService.listRooms();
        console.log('✅ Connection Successful!');
        console.log(`Found ${rooms.length} active rooms.`);
        
        if (rooms.length > 0) {
            console.log('Active Rooms:');
            rooms.forEach(r => console.log(` - ${r.name} (${r.numParticipants} participants)`));
        }
        
    } catch (error: any) {
        console.error('❌ Connection Failed!');
        console.error('Error Message:', error.message);
        if (error.response) {
            console.error('Response Data:', error.response.data);
            console.error('Status:', error.response.status);
        }
        process.exit(1);
    }
}

testConnection();
