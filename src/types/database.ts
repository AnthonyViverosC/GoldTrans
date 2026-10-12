// Tipos del esquema de Supabase (migraciones en supabase/migrations/).
// Regenerar con: npx supabase gen types typescript --project-id <id> > src/types/database.ts
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      roles: {
        Row: { codigo: string; nombre: string; descripcion: string };
        Insert: { codigo: string; nombre: string; descripcion: string };
        Update: { codigo?: string; nombre?: string; descripcion?: string };
        Relationships: [];
      };
      usuarios: {
        Row: {
          id: string;
          email: string;
          rol: string;
          activo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          rol?: string;
          activo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          rol?: string;
          activo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'usuarios_rol_fkey';
            columns: ['rol'];
            isOneToOne: false;
            referencedRelation: 'roles';
            referencedColumns: ['codigo'];
          },
        ];
      };
      perfiles: {
        Row: {
          usuario_id: string;
          tipo_persona: string;
          nombre_completo: string;
          tipo_documento: string | null;
          numero_documento: string | null;
          razon_social: string | null;
          nit: string | null;
          telefono: string | null;
          ciudad: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          usuario_id: string;
          tipo_persona: string;
          nombre_completo: string;
          tipo_documento?: string | null;
          numero_documento?: string | null;
          razon_social?: string | null;
          nit?: string | null;
          telefono?: string | null;
          ciudad?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          usuario_id?: string;
          tipo_persona?: string;
          nombre_completo?: string;
          tipo_documento?: string | null;
          numero_documento?: string | null;
          razon_social?: string | null;
          nit?: string | null;
          telefono?: string | null;
          ciudad?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'perfiles_usuario_id_fkey';
            columns: ['usuario_id'];
            isOneToOne: true;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
        ];
      };
      vehiculos: {
        Row: {
          id: string;
          placa: string;
          tipo: string;
          marca: string;
          modelo: string;
          anio: number;
          capacidad_pasajeros: number;
          estado: string;
          soat_vence: string | null;
          tecnomecanica_vence: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          placa: string;
          tipo: string;
          marca: string;
          modelo: string;
          anio: number;
          capacidad_pasajeros: number;
          estado?: string;
          soat_vence?: string | null;
          tecnomecanica_vence?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          placa?: string;
          tipo?: string;
          marca?: string;
          modelo?: string;
          anio?: number;
          capacidad_pasajeros?: number;
          estado?: string;
          soat_vence?: string | null;
          tecnomecanica_vence?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      health_check: { Args: Record<string, never>; Returns: Json };
      rol_actual: { Args: Record<string, never>; Returns: string };
      tiene_rol: { Args: { roles: string[] }; Returns: boolean };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type PublicTables = Database['public']['Tables'];
export type Tables<T extends keyof PublicTables> = PublicTables[T]['Row'];
export type TablesInsert<T extends keyof PublicTables> = PublicTables[T]['Insert'];
export type TablesUpdate<T extends keyof PublicTables> = PublicTables[T]['Update'];
