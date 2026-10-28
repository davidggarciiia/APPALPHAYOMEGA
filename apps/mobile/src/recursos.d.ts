declare module "*.png" {
  const imagen: import("react-native").ImageSourcePropType
  export default imagen
}
declare module "*.webp" {
  const imagen: import("react-native").ImageSourcePropType
  export default imagen
}
declare module "*.ttf" {
  const fuente: import("expo-font").FontSource
  export default fuente
}
declare module "*.mp4" {
  const clip: import("expo-video").VideoSource
  export default clip
}
