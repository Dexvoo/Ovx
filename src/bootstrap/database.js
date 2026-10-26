import mongoose from 'mongoose';
import { ENV } from '../bootstrap/environment.js';
import { LogData } from '../shared/utils/logger.js';

/**
 * Connects to MongoDB. Throws on failure; startup (client.js) logs it and exits.
 */
export async function Database_Connect() {
    await mongoose.connect(ENV.MONGO_URI);
    LogData('MongoDB', 'Connected to the database successfully.', 'success');
}

/**
 * @returns {boolean} Whether mongoose currently has an open connection
 */
export function Database_IsConnected() {
    return mongoose.connection.readyState === 1;
}

export async function Database_Disconnect() {
    try {
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
            LogData('MongoDB', 'Disconnected from the database successfully.', 'success');
        }
    } catch (error) {
        LogData('MongoDB', `Failed to disconnect from server: ${error.message}`, 'error');
    }
}
