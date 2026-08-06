#!/bin/bash
set -e

APP_NAME="$1"

# If the android folder doesn't exist, initialize it
if [ ! -d "android" ]; then
  npx cap add android
fi

# Inject Custom AndroidManifest.xml if it exists in android_config
if [ -f "android_config/AndroidManifest.xml" ] && [ -d "android/app/src/main" ]; then
  cp android_config/AndroidManifest.xml android/app/src/main/AndroidManifest.xml
fi

# Copy Firebase google-services.json if present
for location in "google-services.json" "google-service.json" "android_config/google-services.json" "android_config/google-service.json"; do
  if [ -f "$location" ]; then
    echo "Found Firebase configuration at: $location"
    cp "$location" android/app/google-services.json
    break
  fi
done

# Synchronize Web assets with Android Native directory
npx cap sync android

STRINGS_FILE="android/app/src/main/res/values/strings.xml"
if [ -f "$STRINGS_FILE" ]; then
  if ! grep -q "default_notification_channel_id" "$STRINGS_FILE"; then
    sed -i 's#</resources>#    <string name="default_notification_channel_id">default</string>\n</resources>#' "$STRINGS_FILE"
  fi
  # Also update app name in strings.xml just to be sure
  sed -i "s#<string name=\"app_name\">.*</string>#<string name=\"app_name\">${APP_NAME}</string>#" "$STRINGS_FILE"
fi
