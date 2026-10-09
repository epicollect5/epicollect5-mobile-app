package uk.ac.imperial.epicollect.five;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;

import java.util.ArrayList;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        //local plugin: queued into the bridge builder before the bridge loads
        registerPlugin(NightModePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
