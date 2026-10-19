package com.pocket.financetracker;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PurchaseStoragePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
