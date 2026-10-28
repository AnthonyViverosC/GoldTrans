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
      rutas: {
        Row: {
          id: string;
          origen: string;
          destino: string;
          distancia_km: number;
          duracion_horas: number | null;
          peajes: number;
          activo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          origen: string;
          destino: string;
          distancia_km: number;
          duracion_horas?: number | null;
          peajes?: number;
          activo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          origen?: string;
          destino?: string;
          distancia_km?: number;
          duracion_horas?: number | null;
          peajes?: number;
          activo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tarifas: {
        Row: {
          id: string;
          tipo_vehiculo: string;
          jornada_horas: number;
          valor_jornada: number;
          km_incluidos_dia: number;
          valor_km_adicional: number;
          recargo_fin_semana_pct: number;
          ruta_id: string | null;
          vigencia_desde: string;
          vigencia_hasta: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tipo_vehiculo: string;
          jornada_horas?: number;
          valor_jornada: number;
          km_incluidos_dia?: number;
          valor_km_adicional: number;
          recargo_fin_semana_pct?: number;
          ruta_id?: string | null;
          vigencia_desde: string;
          vigencia_hasta?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tipo_vehiculo?: string;
          jornada_horas?: number;
          valor_jornada?: number;
          km_incluidos_dia?: number;
          valor_km_adicional?: number;
          recargo_fin_semana_pct?: number;
          ruta_id?: string | null;
          vigencia_desde?: string;
          vigencia_hasta?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tarifas_ruta_id_fkey';
            columns: ['ruta_id'];
            isOneToOne: false;
            referencedRelation: 'rutas';
            referencedColumns: ['id'];
          },
        ];
      };
      cotizaciones: {
        Row: {
          id: string;
          codigo: string;
          usuario_id: string | null;
          ruta_id: string;
          origen: string;
          destino: string;
          tarifa_id: string;
          tipo_servicio: string;
          fecha_inicio: string;
          fecha_fin: string;
          dias: number;
          pasajeros: number;
          tipo_vehiculo: string;
          capacidad_vehiculo: number;
          distancia_km: number;
          valor_total: number;
          duracion_ms: number | null;
          jornada_horas: number | null;
          km_incluidos_dia: number | null;
          valor_km_adicional: number | null;
          created_at: string;
        };
        // Solo la Edge Function calcular-tarifa crea cotizaciones.
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'cotizaciones_ruta_id_fkey';
            columns: ['ruta_id'];
            isOneToOne: false;
            referencedRelation: 'rutas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cotizaciones_tarifa_id_fkey';
            columns: ['tarifa_id'];
            isOneToOne: false;
            referencedRelation: 'tarifas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cotizaciones_usuario_id_fkey';
            columns: ['usuario_id'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
        ];
      };
      detalle_cotizacion: {
        Row: {
          id: string;
          cotizacion_id: string;
          orden: number;
          concepto: string;
          descripcion: string;
          cantidad: number;
          valor_unitario: number;
          subtotal: number;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'detalle_cotizacion_cotizacion_id_fkey';
            columns: ['cotizacion_id'];
            isOneToOne: false;
            referencedRelation: 'cotizaciones';
            referencedColumns: ['id'];
          },
        ];
      };
      solicitudes: {
        Row: {
          id: string;
          codigo: string;
          cotizacion_id: string;
          usuario_id: string;
          estado: string;
          nombre_contacto: string;
          telefono_contacto: string;
          direccion_recogida: string;
          hora_recogida: string;
          observaciones: string | null;
          valor_cotizado: number;
          valor_final: number | null;
          motivo: string | null;
          asesor_id: string | null;
          respondida_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'solicitudes_cotizacion_id_fkey';
            columns: ['cotizacion_id'];
            isOneToOne: true;
            referencedRelation: 'cotizaciones';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'solicitudes_usuario_id_fkey';
            columns: ['usuario_id'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'solicitudes_asesor_id_fkey';
            columns: ['asesor_id'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
        ];
      };
      paquetes: {
        Row: {
          id: string;
          nombre: string;
          destino: string;
          descripcion: string;
          duracion_dias: number;
          duracion_noches: number;
          precio_por_persona: number;
          incluye: string[];
          no_incluye: string[];
          activo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          destino: string;
          descripcion?: string;
          duracion_dias: number;
          duracion_noches?: number;
          precio_por_persona: number;
          incluye?: string[];
          no_incluye?: string[];
          activo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nombre?: string;
          destino?: string;
          descripcion?: string;
          duracion_dias?: number;
          duracion_noches?: number;
          precio_por_persona?: number;
          incluye?: string[];
          no_incluye?: string[];
          activo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      imagenes_paquete: {
        Row: {
          id: string;
          paquete_id: string;
          ruta: string;
          orden: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          paquete_id: string;
          ruta: string;
          orden?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          paquete_id?: string;
          ruta?: string;
          orden?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'imagenes_paquete_paquete_id_fkey';
            columns: ['paquete_id'];
            isOneToOne: false;
            referencedRelation: 'paquetes';
            referencedColumns: ['id'];
          },
        ];
      };
      itinerario_paquete: {
        Row: {
          id: string;
          paquete_id: string;
          dia: number;
          titulo: string;
          descripcion: string;
        };
        Insert: {
          id?: string;
          paquete_id: string;
          dia: number;
          titulo: string;
          descripcion?: string;
        };
        Update: {
          id?: string;
          paquete_id?: string;
          dia?: number;
          titulo?: string;
          descripcion?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'itinerario_paquete_paquete_id_fkey';
            columns: ['paquete_id'];
            isOneToOne: false;
            referencedRelation: 'paquetes';
            referencedColumns: ['id'];
          },
        ];
      };
      fechas_salida: {
        Row: {
          id: string;
          paquete_id: string;
          fecha_salida: string;
          fecha_regreso: string;
          cupos_totales: number;
          cupos_reservados: number;
          cupos_disponibles: number;
          estado: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          paquete_id: string;
          fecha_salida: string;
          fecha_regreso: string;
          cupos_totales: number;
          estado?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          paquete_id?: string;
          fecha_salida?: string;
          fecha_regreso?: string;
          cupos_totales?: number;
          estado?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fechas_salida_paquete_id_fkey';
            columns: ['paquete_id'];
            isOneToOne: false;
            referencedRelation: 'paquetes';
            referencedColumns: ['id'];
          },
        ];
      };
      reservas: {
        Row: {
          id: string;
          codigo: string;
          usuario_id: string;
          fecha_salida_id: string;
          paquete_nombre: string;
          destino: string;
          fecha_salida: string;
          fecha_regreso: string;
          cupos: number;
          precio_por_persona: number;
          valor_total: number;
          abono_minimo: number;
          valor_abonado: number;
          saldo: number;
          estado: string;
          vence_at: string;
          fecha_limite_pago: string;
          telefono_contacto: string;
          observaciones: string | null;
          motivo_cancelacion: string | null;
          cancelada_por: string | null;
          confirmada_at: string | null;
          pagada_at: string | null;
          cancelada_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'reservas_usuario_id_fkey';
            columns: ['usuario_id'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reservas_cancelada_por_fkey';
            columns: ['cancelada_por'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reservas_fecha_salida_id_fkey';
            columns: ['fecha_salida_id'];
            isOneToOne: false;
            referencedRelation: 'fechas_salida';
            referencedColumns: ['id'];
          },
        ];
      };
      viajeros: {
        Row: {
          id: string;
          reserva_id: string;
          orden: number;
          nombre_completo: string;
          tipo_documento: string;
          numero_documento: string;
          fecha_nacimiento: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'viajeros_reserva_id_fkey';
            columns: ['reserva_id'];
            isOneToOne: false;
            referencedRelation: 'reservas';
            referencedColumns: ['id'];
          },
        ];
      };
      abonos: {
        Row: {
          id: string;
          reserva_id: string;
          valor: number;
          fecha_transferencia: string;
          referencia: string | null;
          comprobante_ruta: string;
          comprobante_tipo: string;
          estado: string;
          motivo: string | null;
          asesor_id: string | null;
          revisado_at: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'abonos_reserva_id_fkey';
            columns: ['reserva_id'];
            isOneToOne: false;
            referencedRelation: 'reservas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'abonos_asesor_id_fkey';
            columns: ['asesor_id'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
        ];
      };
      categorias_doc: {
        Row: { id: string; nombre: string; descripcion: string; orden: number; created_at: string };
        Insert: { id?: string; nombre: string; descripcion?: string; orden?: number; created_at?: string };
        Update: { id?: string; nombre?: string; descripcion?: string; orden?: number; created_at?: string };
        Relationships: [];
      };
      documentos: {
        Row: {
          id: string;
          categoria_id: string;
          nombre: string;
          descripcion: string;
          version_actual: number;
          creado_por: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: { categoria_id?: string; nombre?: string; descripcion?: string };
        Relationships: [
          {
            foreignKeyName: 'documentos_categoria_id_fkey';
            columns: ['categoria_id'];
            isOneToOne: false;
            referencedRelation: 'categorias_doc';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'documentos_creado_por_fkey';
            columns: ['creado_por'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
        ];
      };
      versiones_doc: {
        Row: {
          id: string;
          documento_id: string;
          version: number;
          ruta: string;
          nombre_archivo: string;
          tipo_mime: string;
          tamano_bytes: number;
          notas: string | null;
          subido_por: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'versiones_doc_documento_id_fkey';
            columns: ['documento_id'];
            isOneToOne: false;
            referencedRelation: 'documentos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'versiones_doc_subido_por_fkey';
            columns: ['subido_por'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
        ];
      };
      vigencias: {
        Row: {
          documento_id: string;
          fecha_expedicion: string | null;
          fecha_vencimiento: string;
          responsable_id: string;
          notas: string | null;
          actualizado_por: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          documento_id: string;
          fecha_expedicion?: string | null;
          fecha_vencimiento: string;
          responsable_id: string;
          notas?: string | null;
        };
        Update: {
          fecha_expedicion?: string | null;
          fecha_vencimiento?: string;
          responsable_id?: string;
          notas?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'vigencias_documento_id_fkey';
            columns: ['documento_id'];
            isOneToOne: true;
            referencedRelation: 'documentos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'vigencias_responsable_id_fkey';
            columns: ['responsable_id'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
        ];
      };
      alertas: {
        Row: {
          id: string;
          documento_id: string;
          responsable_id: string;
          umbral: number;
          fecha_vencimiento: string;
          dias_restantes: number;
          mensaje: string;
          correo_enviado_at: string | null;
          leida_at: string | null;
          created_at: string;
        };
        Insert: never;
        Update: { leida_at?: string | null };
        Relationships: [
          {
            foreignKeyName: 'alertas_documento_id_fkey';
            columns: ['documento_id'];
            isOneToOne: false;
            referencedRelation: 'documentos';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'alertas_responsable_id_fkey';
            columns: ['responsable_id'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
        ];
      };
      procesos_licitacion: {
        Row: {
          id: string;
          numero: string;
          entidad: string;
          objeto: string;
          fecha_cierre: string;
          valor_estimado: number | null;
          estado: string;
          enlace: string | null;
          notas: string | null;
          responsable_id: string | null;
          creado_por: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          numero: string;
          entidad: string;
          objeto: string;
          fecha_cierre: string;
          valor_estimado?: number | null;
          estado?: string;
          enlace?: string | null;
          notas?: string | null;
          responsable_id?: string | null;
        };
        Update: {
          numero?: string;
          entidad?: string;
          objeto?: string;
          fecha_cierre?: string;
          valor_estimado?: number | null;
          estado?: string;
          enlace?: string | null;
          notas?: string | null;
          responsable_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'procesos_licitacion_responsable_id_fkey';
            columns: ['responsable_id'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'procesos_licitacion_creado_por_fkey';
            columns: ['creado_por'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
        ];
      };
      items_verificacion: {
        Row: {
          id: string;
          proceso_id: string;
          orden: number;
          requisito: string;
          obligatorio: boolean;
          documento_id: string | null;
          cumplido_manual: boolean;
          notas: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          proceso_id: string;
          orden?: number;
          requisito: string;
          obligatorio?: boolean;
          documento_id?: string | null;
          cumplido_manual?: boolean;
          notas?: string | null;
        };
        Update: {
          orden?: number;
          requisito?: string;
          obligatorio?: boolean;
          documento_id?: string | null;
          cumplido_manual?: boolean;
          notas?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'items_verificacion_proceso_id_fkey';
            columns: ['proceso_id'];
            isOneToOne: false;
            referencedRelation: 'procesos_licitacion';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'items_verificacion_documento_id_fkey';
            columns: ['documento_id'];
            isOneToOne: false;
            referencedRelation: 'documentos';
            referencedColumns: ['id'];
          },
        ];
      };
      bitacora_descargas: {
        Row: {
          id: string;
          proceso_id: string;
          usuario_id: string | null;
          documentos: number;
          vencidos: number;
          tamano_bytes: number;
          ruta: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'bitacora_descargas_proceso_id_fkey';
            columns: ['proceso_id'];
            isOneToOne: false;
            referencedRelation: 'procesos_licitacion';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bitacora_descargas_usuario_id_fkey';
            columns: ['usuario_id'];
            isOneToOne: false;
            referencedRelation: 'usuarios';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      health_check: { Args: Record<string, never>; Returns: Json };
      rol_actual: { Args: Record<string, never>; Returns: string };
      tiene_rol: { Args: { roles: string[] }; Returns: boolean };
      hoy_colombia: { Args: Record<string, never>; Returns: string };
      paquete_publicado: { Args: { p_paquete_id: string }; Returns: boolean };
      crear_solicitud: {
        Args: {
          p_cotizacion_id: string;
          p_nombre_contacto: string;
          p_telefono_contacto: string;
          p_direccion_recogida: string;
          p_hora_recogida: string;
          p_observaciones?: string | null;
        };
        Returns: Database['public']['Tables']['solicitudes']['Row'];
      };
      responder_solicitud: {
        Args: { p_solicitud_id: string; p_accion: string; p_valor?: number | null; p_motivo?: string | null };
        Returns: Database['public']['Tables']['solicitudes']['Row'];
      };
      decidir_solicitud: {
        Args: { p_solicitud_id: string; p_accion: string };
        Returns: Database['public']['Tables']['solicitudes']['Row'];
      };
      crear_reserva: {
        Args: {
          p_fecha_salida_id: string;
          p_viajeros: Json;
          p_telefono_contacto: string;
          p_observaciones?: string | null;
        };
        Returns: Database['public']['Tables']['reservas']['Row'];
      };
      cancelar_reserva: {
        Args: { p_reserva_id: string; p_motivo?: string | null };
        Returns: Database['public']['Tables']['reservas']['Row'];
      };
      registrar_abono: {
        Args: {
          p_reserva_id: string;
          p_valor: number;
          p_fecha_transferencia: string;
          p_comprobante_ruta: string;
          p_referencia?: string | null;
        };
        Returns: Database['public']['Tables']['abonos']['Row'];
      };
      verificar_abono: {
        Args: { p_abono_id: string; p_accion: string; p_motivo?: string | null };
        Returns: Database['public']['Tables']['abonos']['Row'];
      };
      vencer_prerreservas: {
        Args: { p_fecha_salida_id?: string | null };
        Returns: { reservas_vencidas: number; cupos_liberados: number }[];
      };
      crear_documento: {
        Args: {
          p_categoria_id: string;
          p_nombre: string;
          p_ruta: string;
          p_nombre_archivo: string;
          p_descripcion?: string | null;
          p_notas?: string | null;
        };
        Returns: Database['public']['Tables']['documentos']['Row'];
      };
      agregar_version_documento: {
        Args: { p_documento_id: string; p_ruta: string; p_nombre_archivo: string; p_notas?: string | null };
        Returns: Database['public']['Tables']['versiones_doc']['Row'];
      };
      estado_vigencia: { Args: { p_vence: string | null; p_hoy: string }; Returns: string };
      generar_alertas_vencimiento: {
        Args: { p_hoy?: string | null };
        Returns: { alerta_id: string; email: string; documento: string; mensaje: string }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type PublicTables = Database['public']['Tables'];
export type Tables<T extends keyof PublicTables> = PublicTables[T]['Row'];
export type TablesInsert<T extends keyof PublicTables> = PublicTables[T]['Insert'];
export type TablesUpdate<T extends keyof PublicTables> = PublicTables[T]['Update'];
