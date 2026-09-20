# Build the Android APK / AAB

This guide turns the game into installable Android binaries using **Capacitor**.
The game itself is finished - you are only wrapping the `www/` folder in a
native shell and wiring the AdMob native SDK.

> Currently AdMob runs in **TEST MODE** (Google's official test ad units).
> You can verify ads on a real device immediately - test ads always load.

---

## 1. Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Node.js | 18+ | `node -v` |
| JDK | 17 (Temurin recommended) | `java -version` |
| Android Studio | latest (installs SDK 34/35) | - |
| `ANDROID_HOME` | set by Android Studio | `echo $ANDROID_HOME` |

Install Android Studio, open the SDK Manager, and install:
- Android SDK Platform 35 (or 34)
- Android SDK Build-Tools
- Android SDK Command-line Tools

Accept licenses: `yes | sdkmanager --licenses`

## 2. Install the Capacitor shell

From the project root (`run-in-the-garden/`):

```bash
npm install                       # installs @capacitor/core, cli, android, @capacitor-community/admob
npx cap add android               # creates the android/ native project
npx cap sync android              # copies www/ + configures plugins
```

`capacitor.config.ts` already contains:

- `appId: com.gardenstudio.runinthegarden` (change if you like)
- `webDir: "www"`
- the AdMob **test** app ID + child-safe settings

## 3. AdMob manifest entry

Newer plugin versions auto-merge the app ID during `cap sync`. To be certain,
add this inside `<application>` in
`android/app/src/main/AndroidManifest.xml`:

```xml
<meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="ca-app-pub-3940256099942544~3347511713"/>
```

(The value is Google's TEST app ID - exactly what we want for now.)

## 4. Build a debug APK (install and test ads right away)

```bash
cd android
./gradlew assembleDebug
# output: app/build/outputs/apk/debug/app-debug.apk
adb install app/build/outputs/apk/debug/app-debug.apk
```

On the device you should see:
- "ADMOB TEST MODE (NATIVE)" badge in the main menu
- a real **test banner** on menu screens
- a **test interstitial** on every 3rd game over
- **test rewarded videos** from the revive / double-coins buttons
- (first cold start) a **test app-open** ad

## 5. Build the release APK

1. Create a keystore (keep it safe - you need the SAME one for every update):

```bash
keytool -genkey -v -keystore garden-release.keystore \
        -alias garden -keyalg RSA -keysize 2048 -validity 10000
```

2. Wire signing into `android/app/build.gradle`:

```gradle
android {
    signingConfigs {
        release {
            storeFile file('../../garden-release.keystore')
            storePassword 'YOUR_STORE_PASSWORD'
            keyAlias 'garden'
            keyPassword 'YOUR_KEY_PASSWORD'
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
        }
    }
}
```

3. Build:

```bash
cd android
./gradlew assembleRelease
# output: app/build/outputs/apk/release/app-release.apk
```

## 6. Build the AAB (Google Play upload format)

```bash
cd android
./gradlew bundleRelease
# output: app/build/outputs/bundle/release/app-release.aab
```

Need an APK from an AAB (for sideloading)? Use bundletool:

```bash
java -jar bundletool.jar build-apks \
     --bundle=app-release.aab --output=garden.apks \
     --ks=../../garden-release.keystore --ks-key-alias=garden
java -jar bundletool.jar install-apks --apks=garden.apks
```

## 7. Switching from test ads to production (later)

1. In the [AdMob console](https://apps.admob.com): create the app and units
   (banner, interstitial, rewarded, app open).
2. Replace the test IDs in **two files**:
   - `js/config.js` -> `RG.Config.ads.ids`
   - `capacitor.config.ts` -> `plugins.AdMob.appId`
3. Change `initializeForTesting` to `false`.
4. Update the AndroidManifest meta-data value with your production app ID.
5. Add Google's UMP consent SDK (recommended; the plugin docs include it).
6. Re-run `npx cap sync android` and rebuild.

While IDs are still test IDs, keep `js/config.js -> testMode: true` so QA
knows the build is not production-safe.

## 8. Play Store checklist

- AAB from step 6, signed with the release keystore
- App icons: `icon-1024.png` (Play listing), in-app icons already bundled
- Screenshots: `screenshots/` folder (phone, 9:16)
- Feature graphic: `feature-graphic.png` (1024x500)
- Privacy policy URL: host `legal/privacy-policy.html` anywhere public
- Data safety form: "No data collected" while in test mode; before production
  ads, declare AdMob data usage per Google's guidance
- Content rating questionnaire: ads present -> "Yes"; no user interaction with
  ads to download anything
- Target audience: the app requests child-directed ad treatment

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Blank screen in APK | `npx cap sync android`, rebuild; check `chrome://inspect` |
| Ads never load (native) | Confirm manifest meta-data + internet permission (auto-added) |
| `SDK location not found` | Create `android/local.properties` with `sdk.dir=/path/to/sdk` |
| Gradle version error | Use the Gradle wrapper (`./gradlew`), not a system install |
| Test banner not showing | Emulators need Google Play images; use a real device for ads |
