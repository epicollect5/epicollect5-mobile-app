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
@CapacitorPlugin(name = "Theme")
public class ThemePlugin extends Plugin {

    @PluginMethod
    public void setTheme(PluginCall call) {
        String theme = call.getString("theme");

        final int nightMode;
        if ("light".equals(theme)) {
            nightMode = AppCompatDelegate.MODE_NIGHT_NO;
        } else if ("dark".equals(theme)) {
            nightMode = AppCompatDelegate.MODE_NIGHT_YES;
        } else if ("system".equals(theme)) {
            nightMode = AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM;
        } else {
            call.reject("Invalid theme: " + theme);
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
