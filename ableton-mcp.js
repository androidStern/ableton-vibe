import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { Ableton } from 'ableton-js';
import { execSync } from 'child_process';
// The ableton midi script uses a specific temp dir to store server ports. This is my hack to make sure our server resolves to the same temp dir.
const userTempDir = execSync('getconf DARWIN_USER_TEMP_DIR').toString().trim();
process.env.TMPDIR = userTempDir;
const logger = {
    // until i figure out why you cant console.log in mcp context, everything uses console.error
    debug: (msg, ...args) => console.error(`[DEBUG] ${msg}`, ...args),
    info: (msg, ...args) => console.error(`[INFO] ${msg}`, ...args),
    warn: (msg, ...args) => console.error(`[WARN] ${msg}`, ...args),
    error: (msg, ...args) => console.error(`[ERROR] ${msg}`, ...args),
    log: (msg, ...args) => console.error(`[LOG] ${msg}`, ...args)
};
/**
 * Simple class to keep a single Ableton connection
 */
class AbletonConnection {
    constructor() {
        this.connected = false;
        logger.info('AbletonConnection: Initializing new instance');
        this.ableton = new Ableton({ logger });
    }
    static getInstance() {
        if (!this.instance) {
            logger.info('AbletonConnection: Creating singleton instance');
            this.instance = new AbletonConnection();
        }
        logger.debug('AbletonConnection: Returning existing instance');
        return this.instance;
    }
    async connect() {
        if (!this.connected) {
            logger.info('AbletonConnection: Attempting to connect with 5s timeout');
            try {
                await this.ableton.start(5000); // 5s timeout
                this.connected = true;
                logger.info('AbletonConnection: Successfully connected');
            }
            catch (error) {
                logger.error('AbletonConnection: Failed to connect', error);
                throw error;
            }
        }
        else {
            logger.debug('AbletonConnection: Already connected, skipping');
        }
    }
    async disconnect() {
        if (this.connected) {
            logger.info('AbletonConnection: Disconnecting');
            try {
                await this.ableton.close();
                this.connected = false;
                logger.info('AbletonConnection: Successfully disconnected');
            }
            catch (error) {
                logger.error('AbletonConnection: Error during disconnect', error);
                throw error;
            }
        }
        else {
            logger.debug('AbletonConnection: Not connected, nothing to disconnect');
        }
    }
    getAbleton() {
        logger.debug('AbletonConnection: Getting Ableton instance');
        return this.ableton;
    }
}
AbletonConnection.instance = null;
/**
 * Main entrypoint for the MCP server
 */
async function main() {
    logger.info('Starting Ableton MCP Server');
    try {
        logger.info('Connecting to Ableton');
        await AbletonConnection.getInstance().connect();
        logger.info('Initializing MCP Server');
        const server = new McpServer({ name: 'AbletonMCP', version: '1.0.0' });
        /**
         * 1) A Resource: 'ableton://song' that returns tempo + isPlaying
         */
        logger.info('Registering resource: song-info (ableton://song)');
        server.resource('song-info', 'ableton://song', async (uri) => {
            logger.debug('Resource requested: ableton://song', { uri: uri.href });
            const ableton = AbletonConnection.getInstance().getAbleton();
            try {
                logger.debug('Fetching song tempo and playing status');
                const tempo = await ableton.song.get('tempo');
                const playing = await ableton.song.get('is_playing');
                logger.debug('Song info retrieved', { tempo, playing });
                const text = `Song Tempo: ${tempo}, playing: ${playing}`;
                return {
                    contents: [
                        {
                            uri: uri.href,
                            text
                        }
                    ]
                };
            }
            catch (error) {
                logger.error('Error fetching song info', error);
                throw error;
            }
        });
        /**
         * 2) A Tool to create a new MIDI track
         */
        logger.info('Registering tool: create_midi_track');
        server.tool('create_midi_track', { index: z.number().default(-1) }, async ({ index }) => {
            logger.debug('Tool invoked: create_midi_track', { index });
            const ableton = AbletonConnection.getInstance().getAbleton();
            try {
                logger.debug(`Creating MIDI track at index ${index}`);
                const track = await ableton.song.createMidiTrack(index);
                logger.info('MIDI track created successfully', { trackName: track.raw.name, index });
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Created MIDI track at index ${index}, track name: ${track.raw.name}`
                        }
                    ]
                };
            }
            catch (error) {
                logger.error('Error creating MIDI track', { index, error });
                throw error;
            }
        });
        logger.info('Setting up signal handlers');
        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
        /**
         * 3) Start listening on stdio
         */
        logger.info('Setting up StdioServerTransport');
        const transport = new StdioServerTransport();
        try {
            logger.info('Connecting MCP server to transport');
            await server.connect(transport);
            logger.info('MCP server successfully connected and listening');
        }
        catch (error) {
            logger.error('Failed to connect MCP server to transport', error);
            throw error;
        }
    }
    catch (error) {
        logger.error('Fatal error in main function', error);
        throw error;
    }
    async function cleanup() {
        logger.info('Cleanup triggered, shutting down gracefully');
        try {
            await AbletonConnection.getInstance().disconnect();
            logger.info('Cleanup complete, exiting process');
            process.exit(0);
        }
        catch (error) {
            logger.error('Error during cleanup', error);
            process.exit(1);
        }
    }
}
// If invoked directly (ESM version):
// In ESM, we need to detect if this is the main module.
import { fileURLToPath } from 'url';
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
    logger.info('Starting as main module');
    main().catch(err => {
        logger.error('Fatal error in main process', err);
        process.exit(1);
    });
}
