export type UserRole =
  | 'super_admin'
  | 'hotel_owner'
  | 'general_manager'
  | 'front_desk'
  | 'housekeeping'
  | 'accountant'
  | 'restaurant_staff'
  | 'maintenance'

export type RoomStatus =
  | 'available'
  | 'occupied'
  | 'dirty'
  | 'clean'
  | 'maintenance'
  | 'out_of_order'
  | 'blocked'

export type ReservationStatus =
  | 'tentative'
  | 'confirmed'
  | 'checked_in'
  | 'checked_out'
  | 'no_show'
  | 'cancelled'

export type Hotel = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  address: string
  city: string
  country: string
  currency: string
  phone: string
  email: string
  vat_rate: number
  timezone: string
  subscription_tier: 'starter' | 'growth' | 'pro' | 'enterprise'
  subscription_status: 'active' | 'trial' | 'suspended' | 'cancelled'
  trial_ends_at: string | null
  whatsapp_number: string | null
  settings: Record<string, unknown>
}

export type Profile = {
  id: string
  hotel_id: string
  full_name: string
  role: UserRole
  phone: string | null
  is_active: boolean
  avatar_url: string | null
  last_login_at: string | null
}

export type RoomType = {
  id: string
  hotel_id: string
  name: string
  description: string
  max_occupancy: number
  base_rate: number
  amenities: string[]
  photos: string[]
  is_active: boolean
}

export type Room = {
  id: string
  hotel_id: string
  room_type_id: string
  number: string
  floor: number
  status: RoomStatus
  notes: string | null
  is_active: boolean
  room_type?: RoomType
}

export type Guest = {
  id: string
  hotel_id: string
  full_name: string
  email: string | null
  phone: string | null
  nationality: string | null
  id_type: 'passport' | 'national_id' | 'drivers_license' | null
  id_number: string | null
  id_scan_url: string | null
  date_of_birth: string | null
  vip_flag: boolean
  vip_notes: string | null
  loyalty_tier: 'standard' | 'silver' | 'gold' | 'platinum'
  total_stays: number
  total_spend: number
  last_stay_at: string | null
  marketing_opt_in: boolean
}

export type Reservation = {
  id: string
  hotel_id: string
  confirmation_number: string
  guest_id: string
  room_id: string | null
  room_type_id: string
  status: ReservationStatus
  check_in_date: string
  check_out_date: string
  actual_check_in_at: string | null
  actual_check_out_at: string | null
  adults: number
  children: number
  rate_plan: string
  rate_per_night: number
  source: string
  special_requests: string | null
  created_at: string
  guest?: Guest
  room?: Room
  room_type?: RoomType
}

export type FolioCharge = {
  id: string
  hotel_id: string
  reservation_id: string
  created_at: string
  charge_type: string
  description: string
  amount: number
  vat_amount: number
  quantity: number
  is_voided: boolean
}

export type Payment = {
  id: string
  hotel_id: string
  reservation_id: string
  created_at: string
  amount: number
  currency: string
  method: string
  reference: string | null
  is_deposit: boolean
}