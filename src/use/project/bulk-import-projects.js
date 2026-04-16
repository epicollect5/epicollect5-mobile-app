import {PARAMETERS} from '@/config';
import {STRINGS} from '@/config/strings';
import {useRootStore} from '@/stores/root-store';
import {notificationService} from '@/services/notification-service';
import {tempDirsService} from '@/services/filesystem/temp-dirs-service';
import {importProject} from '@/use/project/import-project';
import {CapacitorZip} from '@capgo/capacitor-zip';
import {Filesystem} from '@capacitor/filesystem';

export async function bulkImportProjects(zipFile, router) {
    const rootStore = useRootStore();
    let tempDirPath = '';

    try {
        if (rootStore.device.platform === PARAMETERS.WEB) {
            await notificationService.showAlert('Bulk ZIP import is available only on native devices');
            return false;
        }

        tempDirPath = await tempDirsService.createTemporaryDir();
        const normalizedTempDirPath = tempDirPath.replace('file://', '');

        console.log('Temp directory created at:', normalizedTempDirPath);

        await notificationService.showProgressDialog(
            STRINGS[rootStore.language].labels.wait,
            'Extracting ZIP archive...'
        );

        const sourceUri = zipFile.uri || URL.createObjectURL(zipFile);
        const sourcePathClean = sourceUri.replace('file://', '');

        await CapacitorZip.unzip({
            source: sourcePathClean,
            destination: normalizedTempDirPath
        });

        console.log('ZIP extracted successfully');
        notificationService.hideProgressDialog();

        const result = await Filesystem.readdir({
            path: normalizedTempDirPath
        });

        const jsonFiles = result.files
            .filter((file) => file.name && file.name.endsWith('.json'))
            .sort((a, b) => a.name.localeCompare(b.name));

        if (jsonFiles.length === 0) {
            await notificationService.showAlert(
                'No JSON files found in the ZIP archive'
            );
            return false;
        }

        console.log(`Found ${jsonFiles.length} JSON files to import`);

        for (let i = 0; i < jsonFiles.length; i++) {
            const fileName = jsonFiles[i].name;

            try {
                await notificationService.showProgressDialog(
                    STRINGS[rootStore.language].labels.wait,
                    `Importing: ${fileName} (${i + 1}/${jsonFiles.length})`
                );

                const fileContent = await Filesystem.readFile({
                    path: `${normalizedTempDirPath}/${fileName}`,
                    encoding: 'utf8'
                });

                notificationService.hideProgressDialog();

                const jsonData = JSON.parse(fileContent.data);
                const success = await importProject(jsonData, router);

                if (!success) {
                    console.error(`Import failed for ${fileName}`);
                    return false;
                }

                console.log(`Successfully imported: ${fileName}`);
            } catch (error) {
                console.error(`Error importing ${fileName}:`, error);
                notificationService.hideProgressDialog();
                const msg = error?.message || String(error);
                await notificationService.showAlert(
                    `Error importing ${fileName}: ${msg}`
                );
                return false;
            }
        }

        return true;
    } catch (error) {
        console.error('Bulk Import Error:', error);
        notificationService.hideProgressDialog();
        const msg = error?.message || String(error);
        await notificationService.showAlert(msg);
        return false;
    } finally {
        if (tempDirPath) {
            try {
                await tempDirsService.clearTemporaryDir();
                console.log('Temp directory cleaned up');
            } catch (cleanupError) {
                console.warn('Failed to clean up temp directory:', cleanupError);
            }
        }
    }
}
