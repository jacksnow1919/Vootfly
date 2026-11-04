export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      admin_operators: {
        Row: {
          created_at: string
          full_name: string
          id: string
          password_hash: string
          role: Database["public"]["Enums"]["operator_role"]
          work_email: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          password_hash: string
          role?: Database["public"]["Enums"]["operator_role"]
          work_email: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          password_hash?: string
          role?: Database["public"]["Enums"]["operator_role"]
          work_email?: string
        }
        Relationships: []
      }
      aeo_questions: {
        Row: {
          clicks: number | null
          ctr: number | null
          first_seen_at: string
          id: string
          impressions: number | null
          last_seen_at: string
          period_days: number
          position: number | null
          query: string
          route: string | null
          source_name: string | null
          source_type: string
          source_url: string | null
        }
        Insert: {
          clicks?: number | null
          ctr?: number | null
          first_seen_at?: string
          id?: string
          impressions?: number | null
          last_seen_at?: string
          period_days?: number
          position?: number | null
          query: string
          route?: string | null
          source_name?: string | null
          source_type?: string
          source_url?: string | null
        }
        Update: {
          clicks?: number | null
          ctr?: number | null
          first_seen_at?: string
          id?: string
          impressions?: number | null
          last_seen_at?: string
          period_days?: number
          position?: number | null
          query?: string
          route?: string | null
          source_name?: string | null
          source_type?: string
          source_url?: string | null
        }
        Relationships: []
      }
      agent_profiles: {
        Row: {
          agency_name: string
          commission_rate: number
          created_at: string
          id: string
          total_earnings: number
          user_id: string
        }
        Insert: {
          agency_name: string
          commission_rate?: number
          created_at?: string
          id?: string
          total_earnings?: number
          user_id: string
        }
        Update: {
          agency_name?: string
          commission_rate?: number
          created_at?: string
          id?: string
          total_earnings?: number
          user_id?: string
        }
        Relationships: []
      }
      aircraft: {
        Row: {
          created_at: string
          manufacturer: string
          model: string
          type_code: string
        }
        Insert: {
          created_at?: string
          manufacturer: string
          model: string
          type_code: string
        }
        Update: {
          created_at?: string
          manufacturer?: string
          model?: string
          type_code?: string
        }
        Relationships: []
      }
      airline_baggage_fees: {
        Row: {
          airline_iata: string
          cabin: string
          checked_at: string
          checked_bag_1_currency: string | null
          checked_bag_1_fee: number | null
          checked_bag_1_note: string | null
          id: string
          needs_review: boolean
          review_reason: string | null
          source_domain: string
          source_url: string
        }
        Insert: {
          airline_iata: string
          cabin?: string
          checked_at?: string
          checked_bag_1_currency?: string | null
          checked_bag_1_fee?: number | null
          checked_bag_1_note?: string | null
          id?: string
          needs_review?: boolean
          review_reason?: string | null
          source_domain: string
          source_url: string
        }
        Update: {
          airline_iata?: string
          cabin?: string
          checked_at?: string
          checked_bag_1_currency?: string | null
          checked_bag_1_fee?: number | null
          checked_bag_1_note?: string | null
          id?: string
          needs_review?: boolean
          review_reason?: string | null
          source_domain?: string
          source_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "airline_baggage_fees_airline_iata_fkey"
            columns: ["airline_iata"]
            isOneToOne: false
            referencedRelation: "airlines"
            referencedColumns: ["iata_code"]
          },
        ]
      }
      airlines: {
        Row: {
          alliance: string | null
          country_code: string | null
          created_at: string
          iata_code: string
          icao_code: string | null
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          alliance?: string | null
          country_code?: string | null
          created_at?: string
          iata_code: string
          icao_code?: string | null
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          alliance?: string | null
          country_code?: string | null
          created_at?: string
          iata_code?: string
          icao_code?: string | null
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "airlines_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["code"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          booking_id: string | null
          created_at: string
          id: string
          operator_id: string | null
          operator_name: string | null
          operator_role: string | null
          remarks: string | null
        }
        Insert: {
          action: string
          booking_id?: string | null
          created_at?: string
          id?: string
          operator_id?: string | null
          operator_name?: string | null
          operator_role?: string | null
          remarks?: string | null
        }
        Update: {
          action?: string
          booking_id?: string | null
          created_at?: string
          id?: string
          operator_id?: string | null
          operator_name?: string | null
          operator_role?: string | null
          remarks?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "admin_operators"
            referencedColumns: ["id"]
          },
        ]
      }
      baggage_policies: {
        Row: {
          airline_iata: string | null
          cabin: string | null
          carry_on_allowance: string | null
          checked_allowance: string | null
          created_at: string
          id: string
          source_url: string | null
          verified_at: string | null
        }
        Insert: {
          airline_iata?: string | null
          cabin?: string | null
          carry_on_allowance?: string | null
          checked_allowance?: string | null
          created_at?: string
          id?: string
          source_url?: string | null
          verified_at?: string | null
        }
        Update: {
          airline_iata?: string | null
          cabin?: string | null
          carry_on_allowance?: string | null
          checked_allowance?: string | null
          created_at?: string
          id?: string
          source_url?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "baggage_policies_airline_iata_fkey"
            columns: ["airline_iata"]
            isOneToOne: false
            referencedRelation: "airlines"
            referencedColumns: ["iata_code"]
          },
        ]
      }
      bookings: {
        Row: {
          advisor_notified_at: string | null
          airline: string | null
          billing_address: string | null
          billing_city: string | null
          billing_country: string | null
          billing_postal_code: string | null
          cabin_class: string | null
          capture_status: string
          captured_at: string | null
          click_id: string | null
          commission_amount: number | null
          created_at: string
          currency: string
          depart_date: string | null
          destination: string
          gross_fare: number | null
          guest_email: string | null
          guest_phone: string | null
          id: string
          lead_name: string | null
          markup_amount: number | null
          origin: string
          pnr: string | null
          promo_code: string | null
          promo_discount: number
          return_date: string | null
          revalidated_at: string | null
          revalidated_price: number | null
          revalidation_status: string | null
          source: string
          status: Database["public"]["Enums"]["booking_status"]
          supplier_code: string | null
          total_price: number
          traveller_notified_at: string | null
          user_id: string | null
          utm_source: string | null
          verification_notes: string | null
          verification_status: string
          verified_at: string | null
          verified_by: string | null
          verified_by_name: string | null
        }
        Insert: {
          advisor_notified_at?: string | null
          airline?: string | null
          billing_address?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_postal_code?: string | null
          cabin_class?: string | null
          capture_status?: string
          captured_at?: string | null
          click_id?: string | null
          commission_amount?: number | null
          created_at?: string
          currency?: string
          depart_date?: string | null
          destination: string
          gross_fare?: number | null
          guest_email?: string | null
          guest_phone?: string | null
          id?: string
          lead_name?: string | null
          markup_amount?: number | null
          origin: string
          pnr?: string | null
          promo_code?: string | null
          promo_discount?: number
          return_date?: string | null
          revalidated_at?: string | null
          revalidated_price?: number | null
          revalidation_status?: string | null
          source?: string
          status?: Database["public"]["Enums"]["booking_status"]
          supplier_code?: string | null
          total_price?: number
          traveller_notified_at?: string | null
          user_id?: string | null
          utm_source?: string | null
          verification_notes?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
          verified_by_name?: string | null
        }
        Update: {
          advisor_notified_at?: string | null
          airline?: string | null
          billing_address?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_postal_code?: string | null
          cabin_class?: string | null
          capture_status?: string
          captured_at?: string | null
          click_id?: string | null
          commission_amount?: number | null
          created_at?: string
          currency?: string
          depart_date?: string | null
          destination?: string
          gross_fare?: number | null
          guest_email?: string | null
          guest_phone?: string | null
          id?: string
          lead_name?: string | null
          markup_amount?: number | null
          origin?: string
          pnr?: string | null
          promo_code?: string | null
          promo_discount?: number
          return_date?: string | null
          revalidated_at?: string | null
          revalidated_price?: number | null
          revalidation_status?: string | null
          source?: string
          status?: Database["public"]["Enums"]["booking_status"]
          supplier_code?: string | null
          total_price?: number
          traveller_notified_at?: string | null
          user_id?: string | null
          utm_source?: string | null
          verification_notes?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
          verified_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_supplier_code_fkey"
            columns: ["supplier_code"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "bookings_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "admin_operators"
            referencedColumns: ["id"]
          },
        ]
      }
      checkouts: {
        Row: {
          amount: string
          amount_minor: number
          base_amount: string | null
          stripe_payment_method_id: string | null
          card_brand: string | null
          card_last4: string | null
          card_exp_month: number | null
          card_exp_year: number | null
          cardholder_name: string | null
          booking_id: string | null
          booking_status: string
          claimed_at: string | null
          click_id: string | null
          contact: Json
          created_at: string
          currency: string
          failure_code: string | null
          failure_detail: string | null
          id: string
          paid_at: string | null
          payment_status: string
          reference: string
          stripe_payment_intent_id: string | null
          supplier: string
          supplier_offer_id: string
          supplier_order_id: string | null
          supplier_pnr: string | null
          tax_amount: string | null
          test_mode: boolean
          ticket_numbers: string[]
          travellers: Json
          trip: Json
          updated_at: string
          user_id: string | null
          utm_source: string | null
        }
        Insert: {
          amount: string
          amount_minor: number
          base_amount?: string | null
          stripe_payment_method_id?: string | null
          card_brand?: string | null
          card_last4?: string | null
          card_exp_month?: number | null
          card_exp_year?: number | null
          cardholder_name?: string | null
          booking_id?: string | null
          booking_status?: string
          claimed_at?: string | null
          click_id?: string | null
          contact: Json
          created_at?: string
          currency: string
          failure_code?: string | null
          failure_detail?: string | null
          id?: string
          paid_at?: string | null
          payment_status?: string
          reference: string
          stripe_payment_intent_id?: string | null
          supplier?: string
          supplier_offer_id: string
          supplier_order_id?: string | null
          supplier_pnr?: string | null
          tax_amount?: string | null
          test_mode: boolean
          ticket_numbers?: string[]
          travellers: Json
          trip: Json
          updated_at?: string
          user_id?: string | null
          utm_source?: string | null
        }
        Update: {
          amount?: string
          amount_minor?: number
          base_amount?: string | null
          stripe_payment_method_id?: string | null
          card_brand?: string | null
          card_last4?: string | null
          card_exp_month?: number | null
          card_exp_year?: number | null
          cardholder_name?: string | null
          booking_id?: string | null
          booking_status?: string
          claimed_at?: string | null
          click_id?: string | null
          contact?: Json
          created_at?: string
          currency?: string
          failure_code?: string | null
          failure_detail?: string | null
          id?: string
          paid_at?: string | null
          payment_status?: string
          reference?: string
          stripe_payment_intent_id?: string | null
          supplier?: string
          supplier_offer_id?: string
          supplier_order_id?: string | null
          supplier_pnr?: string | null
          tax_amount?: string | null
          test_mode?: boolean
          ticket_numbers?: string[]
          travellers?: Json
          trip?: Json
          updated_at?: string
          user_id?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkouts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      corporate_leads: {
        Row: {
          company: string
          contact_name: string
          created_at: string
          email: string
          group_size: string | null
          id: string
          monthly_spend: string | null
          notes: string | null
          phone: string | null
          routes: string | null
          updated_at: string
        }
        Insert: {
          company: string
          contact_name: string
          created_at?: string
          email: string
          group_size?: string | null
          id?: string
          monthly_spend?: string | null
          notes?: string | null
          phone?: string | null
          routes?: string | null
          updated_at?: string
        }
        Update: {
          company?: string
          contact_name?: string
          created_at?: string
          email?: string
          group_size?: string | null
          id?: string
          monthly_spend?: string | null
          notes?: string | null
          phone?: string | null
          routes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      currencies: {
        Row: {
          iso_code: string
          name: string
          symbol: string
        }
        Insert: {
          iso_code: string
          name: string
          symbol: string
        }
        Update: {
          iso_code?: string
          name?: string
          symbol?: string
        }
        Relationships: []
      }
      deals: {
        Row: {
          airline: string
          cabin_class: string
          created_at: string
          currency: string
          destination: string
          expires_at: string | null
          id: string
          origin: string
          price: number
        }
        Insert: {
          airline: string
          cabin_class?: string
          created_at?: string
          currency?: string
          destination: string
          expires_at?: string | null
          id?: string
          origin: string
          price: number
        }
        Update: {
          airline?: string
          cabin_class?: string
          created_at?: string
          currency?: string
          destination?: string
          expires_at?: string | null
          id?: string
          origin?: string
          price?: number
        }
        Relationships: []
      }
      destination_photos: {
        Row: {
          alt: string
          created_at: string
          credit: string | null
          height: number | null
          place_code: string
          public_url: string
          source: string
          source_id: string
          source_page_url: string | null
          storage_path: string
          thumb_url: string
          updated_at: string
          width: number | null
        }
        Insert: {
          alt: string
          created_at?: string
          credit?: string | null
          height?: number | null
          place_code: string
          public_url: string
          source?: string
          source_id: string
          source_page_url?: string | null
          storage_path: string
          thumb_url: string
          updated_at?: string
          width?: number | null
        }
        Update: {
          alt?: string
          created_at?: string
          credit?: string | null
          height?: number | null
          place_code?: string
          public_url?: string
          source?: string
          source_id?: string
          source_page_url?: string | null
          storage_path?: string
          thumb_url?: string
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "destination_photos_place_code_fkey"
            columns: ["place_code"]
            isOneToOne: true
            referencedRelation: "places"
            referencedColumns: ["code"]
          },
        ]
      }
      eazair_discount_settings: {
        Row: {
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          markup_business: number
          markup_economy: number
          markup_first: number
          markup_premium_economy: number
          promo_code: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          markup_business?: number
          markup_economy?: number
          markup_first?: number
          markup_premium_economy?: number
          promo_code?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          markup_business?: number
          markup_economy?: number
          markup_first?: number
          markup_premium_economy?: number
          promo_code?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      entity_relationships: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          object_id: string
          object_type: string
          relationship_type: string
          source: string | null
          subject_id: string
          subject_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          object_id: string
          object_type: string
          relationship_type: string
          source?: string | null
          subject_id: string
          subject_type: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          object_id?: string
          object_type?: string
          relationship_type?: string
          source?: string | null
          subject_id?: string
          subject_type?: string
        }
        Relationships: []
      }
      fare_leads: {
        Row: {
          cabin: string | null
          company: string | null
          created_at: string
          destination: string | null
          email: string
          full_name: string | null
          id: string
          lead_type: string
          notes: string | null
          origin: string | null
          phone: string | null
          travel_month: string | null
        }
        Insert: {
          cabin?: string | null
          company?: string | null
          created_at?: string
          destination?: string | null
          email: string
          full_name?: string | null
          id?: string
          lead_type: string
          notes?: string | null
          origin?: string | null
          phone?: string | null
          travel_month?: string | null
        }
        Update: {
          cabin?: string | null
          company?: string | null
          created_at?: string
          destination?: string | null
          email?: string
          full_name?: string | null
          id?: string
          lead_type?: string
          notes?: string | null
          origin?: string | null
          phone?: string | null
          travel_month?: string | null
        }
        Relationships: []
      }
      fare_observations: {
        Row: {
          airline_iata: string | null
          cabin: string
          currency: string
          from_code: string
          id: string
          observed_at: string
          price: number
          source: string | null
          supplier_code: string
          suspect: boolean
          to_code: string
        }
        Insert: {
          airline_iata?: string | null
          cabin: string
          currency: string
          from_code: string
          id?: string
          observed_at: string
          price: number
          source?: string | null
          supplier_code: string
          suspect?: boolean
          to_code: string
        }
        Update: {
          airline_iata?: string | null
          cabin?: string
          currency?: string
          from_code?: string
          id?: string
          observed_at?: string
          price?: number
          source?: string | null
          supplier_code?: string
          suspect?: boolean
          to_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "fare_observations_from_code_fkey"
            columns: ["from_code"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "fare_observations_supplier_code_fkey"
            columns: ["supplier_code"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "fare_observations_to_code_fkey"
            columns: ["to_code"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["code"]
          },
        ]
      }
      fare_rules: {
        Row: {
          airline_iata: string | null
          cabin: string | null
          created_at: string
          description: string | null
          id: string
          rule_type: string
          source_url: string | null
          verified_at: string | null
        }
        Insert: {
          airline_iata?: string | null
          cabin?: string | null
          created_at?: string
          description?: string | null
          id?: string
          rule_type: string
          source_url?: string | null
          verified_at?: string | null
        }
        Update: {
          airline_iata?: string | null
          cabin?: string | null
          created_at?: string
          description?: string | null
          id?: string
          rule_type?: string
          source_url?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fare_rules_airline_iata_fkey"
            columns: ["airline_iata"]
            isOneToOne: false
            referencedRelation: "airlines"
            referencedColumns: ["iata_code"]
          },
        ]
      }
      gsc_position_history: {
        Row: {
          checked_at: string
          clicks: number
          ctr: number
          id: string
          impressions: number
          path: string
          period_days: number
          position: number | null
        }
        Insert: {
          checked_at?: string
          clicks: number
          ctr: number
          id?: string
          impressions: number
          path: string
          period_days: number
          position?: number | null
        }
        Update: {
          checked_at?: string
          clicks?: number
          ctr?: number
          id?: string
          impressions?: number
          path?: string
          period_days?: number
          position?: number | null
        }
        Relationships: []
      }
      hotels: {
        Row: {
          city_code: string | null
          created_at: string
          id: string
          name: string
          supplier_code: string | null
          updated_at: string
        }
        Insert: {
          city_code?: string | null
          created_at?: string
          id?: string
          name: string
          supplier_code?: string | null
          updated_at?: string
        }
        Update: {
          city_code?: string | null
          created_at?: string
          id?: string
          name?: string
          supplier_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotels_city_code_fkey"
            columns: ["city_code"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "hotels_supplier_code_fkey"
            columns: ["supplier_code"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["code"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      metric_snapshots: {
        Row: {
          detail: Json | null
          id: string
          metric: string
          passed: boolean | null
          recorded_at: string
          value: number | null
        }
        Insert: {
          detail?: Json | null
          id?: string
          metric: string
          passed?: boolean | null
          recorded_at?: string
          value?: number | null
        }
        Update: {
          detail?: Json | null
          id?: string
          metric?: string
          passed?: boolean | null
          recorded_at?: string
          value?: number | null
        }
        Relationships: []
      }
      passengers: {
        Row: {
          booking_id: string
          created_at: string
          dob: string | null
          first_name: string
          gender: string | null
          id: string
          last_name: string
          passport_no: string | null
          title: string | null
        }
        Insert: {
          booking_id: string
          created_at?: string
          dob?: string | null
          first_name: string
          gender?: string | null
          id?: string
          last_name: string
          passport_no?: string | null
          title?: string | null
        }
        Update: {
          booking_id?: string
          created_at?: string
          dob?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          last_name?: string
          passport_no?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "passengers_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          currency: string
          id: string
          method: string | null
          status: string
          transaction_ref: string | null
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          currency?: string
          id?: string
          method?: string | null
          status?: string
          transaction_ref?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          currency?: string
          id?: string
          method?: string | null
          status?: string
          transaction_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          code: string
          country_code: string
          created_at: string
          iata: string | null
          is_us_gateway: boolean
          level: string
          name: string
          parent_code: string | null
          region: string | null
          single_airport: boolean
          slug_name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          country_code: string
          created_at?: string
          iata?: string | null
          is_us_gateway?: boolean
          level: string
          name: string
          parent_code?: string | null
          region?: string | null
          single_airport?: boolean
          slug_name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          country_code?: string
          created_at?: string
          iata?: string | null
          is_us_gateway?: boolean
          level?: string
          name?: string
          parent_code?: string | null
          region?: string | null
          single_airport?: boolean
          slug_name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "places_parent_code_fkey"
            columns: ["parent_code"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["code"]
          },
        ]
      }
      price_alerts: {
        Row: {
          baseline_currency: string | null
          baseline_observed_at: string | null
          baseline_price: number | null
          cabin: string
          created_at: string
          depart_date: string | null
          email: string
          from_code: string
          id: string
          is_active: boolean
          last_checked_at: string | null
          last_seen_price: number | null
          notified_at: string | null
          passengers: number
          return_date: string | null
          to_code: string
          user_id: string | null
        }
        Insert: {
          baseline_currency?: string | null
          baseline_observed_at?: string | null
          baseline_price?: number | null
          cabin?: string
          created_at?: string
          depart_date?: string | null
          email: string
          from_code: string
          id?: string
          is_active?: boolean
          last_checked_at?: string | null
          last_seen_price?: number | null
          notified_at?: string | null
          passengers?: number
          return_date?: string | null
          to_code: string
          user_id?: string | null
        }
        Update: {
          baseline_currency?: string | null
          baseline_observed_at?: string | null
          baseline_price?: number | null
          cabin?: string
          created_at?: string
          depart_date?: string | null
          email?: string
          from_code?: string
          id?: string
          is_active?: boolean
          last_checked_at?: string | null
          last_seen_price?: number | null
          notified_at?: string | null
          passengers?: number
          return_date?: string | null
          to_code?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_alerts_from_code_fkey"
            columns: ["from_code"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "price_alerts_to_code_fkey"
            columns: ["to_code"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["code"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          loyalty_tier: Database["public"]["Enums"]["loyalty_tier"]
          wallet_credits: number
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          loyalty_tier?: Database["public"]["Enums"]["loyalty_tier"]
          wallet_credits?: number
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          loyalty_tier?: Database["public"]["Enums"]["loyalty_tier"]
          wallet_credits?: number
        }
        Relationships: []
      }
      route_candidates: {
        Row: {
          cabin: string
          competition_index: number | null
          created_at: string
          from_code: string
          id: string
          keywords_json: Json
          opportunity_score: number | null
          score_error: string | null
          scored_at: string | null
          search_volume: number | null
          status: string
          to_code: string
          updated_at: string
        }
        Insert: {
          cabin?: string
          competition_index?: number | null
          created_at?: string
          from_code: string
          id?: string
          keywords_json?: Json
          opportunity_score?: number | null
          score_error?: string | null
          scored_at?: string | null
          search_volume?: number | null
          status?: string
          to_code: string
          updated_at?: string
        }
        Update: {
          cabin?: string
          competition_index?: number | null
          created_at?: string
          from_code?: string
          id?: string
          keywords_json?: Json
          opportunity_score?: number | null
          score_error?: string | null
          scored_at?: string | null
          search_volume?: number | null
          status?: string
          to_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_candidates_from_code_fkey"
            columns: ["from_code"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "route_candidates_to_code_fkey"
            columns: ["to_code"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["code"]
          },
        ]
      }
      routes: {
        Row: {
          created_at: string
          distance_km: number | null
          from_code: string
          id: string
          notes: string | null
          to_code: string
        }
        Insert: {
          created_at?: string
          distance_km?: number | null
          from_code: string
          id?: string
          notes?: string | null
          to_code: string
        }
        Update: {
          created_at?: string
          distance_km?: number | null
          from_code?: string
          id?: string
          notes?: string | null
          to_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "routes_from_code_fkey"
            columns: ["from_code"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "routes_to_code_fkey"
            columns: ["to_code"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["code"]
          },
        ]
      }
      seo_pages: {
        Row: {
          airline_slug: string | null
          cabin: string
          content_json: Json
          coverage_state: string | null
          created_at: string
          facet: string | null
          fare_snapshot_at: string | null
          fare_snapshot_json: Json | null
          from_code: string | null
          gsc_clicks: number | null
          gsc_ctr: number | null
          gsc_impressions: number | null
          gsc_period_days: number | null
          gsc_position: number | null
          id: string
          indexed_checked_at: string | null
          indexed_status: string | null
          indexing_checked_at: string | null
          is_indexed: boolean | null
          last_crawl_time: string | null
          last_refreshed_at: string | null
          legacy_slug: string | null
          meta_description: string | null
          meta_title: string | null
          page_type: string
          path: string
          performance_checked_at: string | null
          published_at: string | null
          qa_score: number | null
          status: string
          to_code: string | null
          updated_at: string
        }
        Insert: {
          airline_slug?: string | null
          cabin?: string
          content_json?: Json
          coverage_state?: string | null
          created_at?: string
          facet?: string | null
          fare_snapshot_at?: string | null
          fare_snapshot_json?: Json | null
          from_code?: string | null
          gsc_clicks?: number | null
          gsc_ctr?: number | null
          gsc_impressions?: number | null
          gsc_period_days?: number | null
          gsc_position?: number | null
          id?: string
          indexed_checked_at?: string | null
          indexed_status?: string | null
          indexing_checked_at?: string | null
          is_indexed?: boolean | null
          last_crawl_time?: string | null
          last_refreshed_at?: string | null
          legacy_slug?: string | null
          meta_description?: string | null
          meta_title?: string | null
          page_type: string
          path: string
          performance_checked_at?: string | null
          published_at?: string | null
          qa_score?: number | null
          status?: string
          to_code?: string | null
          updated_at?: string
        }
        Update: {
          airline_slug?: string | null
          cabin?: string
          content_json?: Json
          coverage_state?: string | null
          created_at?: string
          facet?: string | null
          fare_snapshot_at?: string | null
          fare_snapshot_json?: Json | null
          from_code?: string | null
          gsc_clicks?: number | null
          gsc_ctr?: number | null
          gsc_impressions?: number | null
          gsc_period_days?: number | null
          gsc_position?: number | null
          id?: string
          indexed_checked_at?: string | null
          indexed_status?: string | null
          indexing_checked_at?: string | null
          is_indexed?: boolean | null
          last_crawl_time?: string | null
          last_refreshed_at?: string | null
          legacy_slug?: string | null
          meta_description?: string | null
          meta_title?: string | null
          page_type?: string
          path?: string
          performance_checked_at?: string | null
          published_at?: string | null
          qa_score?: number | null
          status?: string
          to_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_pages_from_code_fkey"
            columns: ["from_code"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "seo_pages_to_code_fkey"
            columns: ["to_code"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["code"]
          },
        ]
      }
      seo_route_pages: {
        Row: {
          content_json: Json
          created_at: string
          destination: string
          id: string
          meta_description: string | null
          meta_title: string
          origin: string
          slug: string
        }
        Insert: {
          content_json?: Json
          created_at?: string
          destination: string
          id?: string
          meta_description?: string | null
          meta_title: string
          origin: string
          slug: string
        }
        Update: {
          content_json?: Json
          created_at?: string
          destination?: string
          id?: string
          meta_description?: string | null
          meta_title?: string
          origin?: string
          slug?: string
        }
        Relationships: []
      }
      provider_search_log: {
        Row: {
          created_at: string
          destination: string | null
          duration_ms: number
          error: string | null
          fares: number
          id: string
          origin: string | null
          supplier: string
        }
        Insert: {
          created_at?: string
          destination?: string | null
          duration_ms: number
          error?: string | null
          fares?: number
          id?: string
          origin?: string | null
          supplier: string
        }
        Update: {
          created_at?: string
          destination?: string | null
          duration_ms?: number
          error?: string | null
          fares?: number
          id?: string
          origin?: string | null
          supplier?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          code: string
          created_at: string
          name: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          name: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          name?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      tickets: {
        Row: {
          base_fare: number
          booking_id: string
          commission: number
          created_at: string
          id: string
          pnr_code: string | null
          supplier: string | null
          ticket_number: string | null
        }
        Insert: {
          base_fare?: number
          booking_id: string
          commission?: number
          created_at?: string
          id?: string
          pnr_code?: string | null
          supplier?: string | null
          ticket_number?: string | null
        }
        Update: {
          base_fare?: number
          booking_id?: string
          commission?: number
          created_at?: string
          id?: string
          pnr_code?: string | null
          supplier?: string | null
          ticket_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      security_review_summary: { Args: { window_days?: number }; Returns: Json }
    }
    Enums: {
      app_role: "customer" | "agent" | "admin"
      booking_status:
        | "pending"
        | "confirmed"
        | "paid"
        | "issued"
        | "cancelled"
        | "refunded"
      loyalty_tier: "silver" | "gold" | "platinum"
      operator_role: "agent" | "manager" | "superadmin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["customer", "agent", "admin"],
      booking_status: [
        "pending",
        "confirmed",
        "paid",
        "issued",
        "cancelled",
        "refunded",
      ],
      loyalty_tier: ["silver", "gold", "platinum"],
      operator_role: ["agent", "manager", "superadmin"],
    },
  },
} as const
