import pino from 'pino';
import pinoHTTP from 'pino-http';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// Check if file live.log exists, if not = create it
if (!fs.existsSync(path.join(dirname(fileURLToPath(import.meta.url)), '../logs/live.log')))
    fs.writeFileSync(path.join(dirname(fileURLToPath(import.meta.url)), '../logs/live.log'), '');

const fileAndConsole = {
    targets: [
        {
            target: 'pino/file',
            options: { destination: 1 } // this writes to STDOUT
        },
        {
            target: 'pino/file',
            options: { destination: path.join(dirname(fileURLToPath(import.meta.url)), `../logs/live.log`) },
        },
    ]
};

const consoleOnly = {
    targets: [
        {
            target: 'pino/file',
            options: { destination: 1 } // this writes to STDOUT
        },
    ]
};

const fileOnly = {
    target: 'pino/file',
    options: { destination: path.join(dirname(fileURLToPath(import.meta.url)), '../logs/live.log') },
}

const destination = process.env.ENV === 'dev' ? consoleOnly : fileOnly; // where to display logs (file, console or both)
const level = process.env.ENV === 'dev' ? 'trace' : 'info'; // default level if not set

/* LEVELS:
trace
debug
info
warn
error
fatal */

export const logger = pino(
    {
        level,
        timestamp: pino.stdTimeFunctions.isoTime,
    },
    pino.transport(destination)
);

export const httpLogger = pinoHTTP({
    logger, customLogLevel: (req, res, err) => {
        if (err) return 'error';
        if (res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        if (res.statusCode >= 200) return 'silent';
        return 'info';
    },
});