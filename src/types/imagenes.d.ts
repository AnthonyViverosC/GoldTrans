// Imágenes importadas como módulos (Metro las resuelve a un recurso empaquetado).
declare module '*.png' {
  const imagen: import('react-native').ImageSourcePropType;
  export default imagen;
}
