import Foundation
import UIKit
import Capacitor

// Local plugin: pins the window's interface style independently of the iOS
// system appearance, so native pickers/sheets follow the in-app
// Light/Dark/System selection (Android equivalent: NightModePlugin.java).
// Registered via packageClassList in capacitor.config.json — see
// scripts/ensure-ios-nightmode-plugin.js, since `cap copy ios` rewrites that
// list from npm-installed plugins only.
@objc(NightModePlugin)
public class NightModePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NightModePlugin"
    public let jsName = "NightMode"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setNightMode", returnType: CAPPluginReturnPromise)
    ]

    @objc func setNightMode(_ call: CAPPluginCall) {
        let mode = call.getString("mode") ?? ""

        DispatchQueue.main.async {
            let style: UIUserInterfaceStyle
            switch mode {
            case "no":
                style = .light
            case "yes":
                style = .dark
            case "follow_system":
                style = .unspecified
            default:
                call.reject("Invalid night mode: \(mode)")
                return
            }

            guard let window = self.bridge?.viewController?.view.window
                ?? UIApplication.shared.connectedScenes
                    .compactMap({ ($0 as? UIWindowScene)?.keyWindow }).first else {
                call.reject("No window available to apply the interface style")
                return
            }

            window.overrideUserInterfaceStyle = style
            call.resolve()
        }
    }
}
