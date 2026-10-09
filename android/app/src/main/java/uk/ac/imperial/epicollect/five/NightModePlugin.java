package uk.ac.imperial.epicollect.five;

import android.os.Handler;
import android.os.Looper;
import androidx.appcompat.app.AppCompatDelegate;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Pins the native night mode independently of the device theme, so
 * OS-rendered dialogs (date/time pickers, etc.) follow the in-app
 * Light/Dark/System selection instead of the system uiMode.
 */
@CapacitorPlugin(name = "NightMode")
public class NightModePlugin extends Plugin {

    @PluginMethod
    public void setNightMode(PluginCall call) {
        String mode = call.getString("mode");

        final int nightMode;
        if ("no".equals(mode)) {
            nightMode = AppCompatDelegate.MODE_NIGHT_NO;
        } else if ("yes".equals(mode)) {
            nightMode = AppCompatDelegate.MODE_NIGHT_YES;
        } else if ("follow_system".equals(mode)) {
            nightMode = AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM;
        } else {
            call.reject("Invalid night mode: " + mode);
            return;
        }

        //plugin methods run on the CapacitorPlugins background thread, while
        //setDefaultNightMode propagates synchronously to the activity config
        //(SystemBars touches views): must happen on the main thread
        new Handler(Looper.getMainLooper()).post(() -> {
            AppCompatDelegate.setDefaultNightMode(nightMode);
            call.resolve();
        });
    }
}
