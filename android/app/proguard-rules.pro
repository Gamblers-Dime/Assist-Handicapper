# Add project specific ProGuard rules here.
# By default, the flags in this file are applied to all build types
# that have minifyEnabled set to true.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# React Native
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }

# Application classes
-keep class com.basketballiq.courtiq.** { *; }

# Keep native methods
-keepclassmembers class * {
    native <methods>;
}

# Keep annotations
-keepattributes *Annotation*

# Hermes / JSI
-keep class com.facebook.react.turbomodule.** { *; }

# AsyncStorage
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# SQLite storage
-keep class org.pgsqlite.** { *; }

# Vector Icons
-keep class com.oblador.vectoricons.** { *; }

# Redux / JavaScript bridge
-keep public class com.horcrux.svg.** { *; }

# Okhttp (used by Metro bundler)
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
-dontwarn org.conscrypt.**
