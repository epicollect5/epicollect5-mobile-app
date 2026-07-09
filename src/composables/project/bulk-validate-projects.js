import {PARAMETERS} from '@/config';
import {notificationService} from '@/services/notification-service';
import {tempDirsService} from '@/services/filesystem/temp-dirs-service';
import {Filesystem} from '@capacitor/filesystem';
import {FilePicker} from '@capawesome/capacitor-file-picker';
import {useRootStore} from '@/stores/root-store';
import {escapeHtml} from '@/services/errors-service';

function buildReport(results) {
    const total = results.length;
    const passed = results.filter((result) => result.ok);
    const failed = results.filter((result) => !result.ok);
    const plainTextLines = [
        'Bulk validation report',
        `Total: ${total}`,
        `Passed: ${passed.length}`,
        `Failed: ${failed.length}`,
        ''
    ];

    if (failed.length > 0) {
        plainTextLines.push('Failures:');
        failed.forEach((result) => {
            plainTextLines.push(`- ${result.projectLabel} (${result.fileName}): ${result.error}`);
        });
    } else {
        plainTextLines.push('No validation errors found.');
    }

    return {
        htmlMessage: [
            '<strong>Bulk validation report</strong>',
            `<br/><br/>Total: ${total}`,
            `<br/>Passed: ${passed.length}`,
            `<br/>Failed: ${failed.length}`,
            failed.length > 0
                ? `<br/><br/><strong>Failures</strong><br/>${failed.map((result) => `${escapeHtml(result.projectLabel)} : ${escapeHtml(result.error)}`).join('<br/>')}`
                : '<br/><br/>No validation errors found.'
        ].join(''),
        plainText: plainTextLines.join('\n')
    };
}

export async function bulkValidateProjects(zipFile) {
    const rootStore = useRootStore();
    let tempDirPath = '';

    const getInputPath = (file) => {
        if (typeof file?.path === 'string' && file.path.length > 0) {
            return file.path;
        }

        if (typeof file?.uri === 'string' && file.uri.length > 0) {
            return file.uri;
        }

        throw new Error('Could not resolve ZIP file path');
    };

    try {
        if (rootStore.device.platform === PARAMETERS.WEB) {
            await notificationService.showAlert('Bulk ZIP validation is available only on native devices');
            return false;
        }

        const {CapacitorZip} = await import(/* webpackChunkName: "vendor-native-zip" */ '@capgo/capacitor-zip');
        const {validateProjectPayload} = await import(/* webpackChunkName: "native-project-validation" */ '@/composables/project/validate-project-payload');
        tempDirPath = await tempDirsService.createTemporaryDir();
        const normalizedTempDirPath = tempDirPath.replace('file://', '');
        const sourcePath = getInputPath(zipFile);
        const zipFileName = zipFile.name || 'bulk-validate.zip';
        const copiedZipPath = `${normalizedTempDirPath}/${zipFileName}`;
        const extractionPath = `${normalizedTempDirPath}/bulk-validate-${Date.now()}`;

        await notificationService.showProgressDialog('Extracting ZIP archive...', 'Bulk Validate');

        await FilePicker.copyFile({
            from: sourcePath,
            to: copiedZipPath,
            overwrite: true
        });

        await CapacitorZip.unzip({
            source: copiedZipPath,
            destination: extractionPath
        });

        const result = await Filesystem.readdir({
            path: extractionPath
        });

        const jsonFiles = result.files
            .filter((file) => file.name && file.name.endsWith('.json'))
            .sort((a, b) => a.name.localeCompare(b.name));

        if (jsonFiles.length === 0) {
            notificationService.hideProgressDialog();
            await notificationService.showAlert('No JSON files found in the ZIP archive');
            return false;
        }

        const validationResults = [];

        for (let i = 0; i < jsonFiles.length; i++) {
            const fileName = jsonFiles[i].name;

            await notificationService.showProgressDialog(
                `Validating ${i + 1}/${jsonFiles.length}`,
                fileName
            );

            try {
                const fileContent = await Filesystem.readFile({
                    path: `${extractionPath}/${fileName}`,
                    encoding: 'utf8'
                });
                const validated = await validateProjectPayload(fileContent.data, rootStore.language);

                validationResults.push({
                    ok: true,
                    fileName,
                    projectLabel: validated.projectLabel
                });
            } catch (error) {
                validationResults.push({
                    ok: false,
                    fileName,
                    projectLabel: error?.projectLabel || fileName,
                    error: error?.message || String(error)
                });
            }
        }

        notificationService.hideProgressDialog();
        const report = buildReport(validationResults);
        await notificationService.showValidationErrorAlert(report.htmlMessage, report.plainText);
        return validationResults.every((result) => result.ok);
    } catch (error) {
        notificationService.hideProgressDialog();
        await notificationService.showAlert(error?.message || String(error));
        return false;
    } finally {
        if (tempDirPath) {
            try {
                await tempDirsService.clearTemporaryDir();
            } catch (cleanupError) {
                console.warn('Failed to clean up temp directory:', cleanupError);
            }
        }
    }
}
