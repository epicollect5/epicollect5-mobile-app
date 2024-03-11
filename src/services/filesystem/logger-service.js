import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';


const filepath = 'logs/errors.txt';

export const loggerService = {

    async createLogFile() {
        try {
            await Filesystem.writeFile({
                path: filepath,
                data: '',
                directory: Directory.Data,
                encoding: Encoding.UTF8,
                recursive: true
            });
        }
        catch (error) {
            console.error('Error creating log file:', error);
        }
    },

    async readLogFile() {
        const contents = await Filesystem.readFile({
            path: filepath,
            directory: Directory.Data,
            encoding: Encoding.UTF8
        });

        console.log('errors:', contents);
    },

    async clearLogFile() {
        try {
            await Filesystem.deleteFile({
                path: filepath,
                directory: Directory.Data
            });

            this.createLogFile();
        }
        catch (error) {
            console.log(error);
            console.error('Error clearing log file:', error);
        }
    },

    async appendToLogFile(content) {
        try {
            // Appennd the updated content back to the file
            await Filesystem.appendFile({
                path: filepath,
                data: '\n' + new Date().toISOString() + ' --- ' + JSON.stringify(content),
                directory: Directory.Data,
                encoding: Encoding.UTF8,
                recursive: true // Ensure the directory structure exists
            });
            console.log('Data appended to file successfully.');
        } catch (error) {
            console.error('Error appending data to file:', error);
        }
    }
};