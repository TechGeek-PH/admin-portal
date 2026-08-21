# TechGeekPH Installer for iOS

The iOS source is prepared for a native fullscreen app that loads the TechGeekPH Technician Checklist.

## Official iPhone distribution

1. Open the project on macOS with Xcode after generating the Xcode project from `project.yml` using XcodeGen.
2. Select the TechGeekPH Apple Developer Team under Signing & Capabilities.
3. Keep bundle identifier `ph.techgeek.installer` or change it to the registered App ID.
4. Archive the app in Xcode.
5. Upload the archive to App Store Connect.
6. Distribute to technicians using TestFlight, or submit it to the App Store.

Unsigned IPA files cannot be installed normally on arbitrary iPhones. TestFlight/App Store is the intended official installation path.
