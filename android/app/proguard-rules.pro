# Add project specific ProGuard rules here

# React Native
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }

# Nitro Modules
-keep class com.margelo.nitro.** { *; }

# MediaPipe & LiteRT
-keep class com.google.mediapipe.** { *; }
-keep class com.google.ai.edge.** { *; }

# ML Kit
-keep class com.google.mlkit.** { *; }

# NanoHTTPD
-keep class fi.iki.elonen.** { *; }

# Auto Value
-dontwarn javax.lang.model.**
-dontwarn javax.annotation.processing.**
-dontwarn autovalue.shaded.**
-keep class autovalue.shaded.** { *; }

# Suppress warnings for missing classes in R8
-dontwarn com.google.auto.value.**
-dontwarn javax.lang.model.SourceVersion
-dontwarn javax.lang.model.element.Element
-dontwarn javax.lang.model.element.ElementKind
-dontwarn javax.lang.model.element.Modifier
-dontwarn javax.lang.model.type.TypeMirror
-dontwarn javax.lang.model.type.TypeVisitor
-dontwarn javax.lang.model.util.SimpleTypeVisitor8

# MediaPipe missing classes
-dontwarn com.google.mediapipe.proto.CalculatorProfileProto$CalculatorProfile
-dontwarn com.google.mediapipe.proto.GraphTemplateProto$CalculatorGraphTemplate


# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep enums
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}