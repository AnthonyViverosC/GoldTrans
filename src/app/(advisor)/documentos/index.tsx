import { RepositorioDocumentos } from '@/components/repositorio-documentos';

// HU-27 · Repositorio documental (solo asesor y admin; RLS en Supabase).
export default function Documentos() {
  return <RepositorioDocumentos />;
}
