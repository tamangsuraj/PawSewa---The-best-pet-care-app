// User Types
export type UserRole = 'pet_owner' | 'veterinarian' | 'admin';

export interface IUser {
  _id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

// Pet Types
export interface IPet {
  _id: string;
  owner: string | IUser;
  name: string;
  species: string;
  breed?: string;
  age?: number;
  weight?: number;
  image?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Appointment Types
export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export interface IAppointment {
  _id: string;
  pet: string | IPet;
  owner: string | IUser;
  veterinarian: string | IUser;
  date: Date;
  status: AppointmentStatus;
  createdAt: Date;
  updatedAt: Date;
}

// Chat Types
export interface IMessage {
  sender: string | IUser;
  content: string;
  timestamp: Date;
}

export interface IChat {
  _id: string;
  participants: (string | IUser)[];
  messages: IMessage[];
  createdAt: Date;
  updatedAt: Date;
}
