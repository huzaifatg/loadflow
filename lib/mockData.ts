import type { Truck, Driver, Delivery, LoadPlan } from '@prisma/client';

export const MOCK_TRUCKS: Truck[] = [
  { id: 'mock-t1', companyId: 'mock-c', name: 'Volvo FH16', plateNumber: 'XYZ-1234', weightCapacity: 44000, status: 'AVAILABLE', notes: null, createdAt: new Date(), updatedAt: new Date() },
  { id: 'mock-t2', companyId: 'mock-c', name: 'Scania R450', plateNumber: 'ABC-9876', weightCapacity: 40000, status: 'IN_USE', notes: null, createdAt: new Date(), updatedAt: new Date() },
  { id: 'mock-t3', companyId: 'mock-c', name: 'Mercedes Actros', plateNumber: 'LMN-5555', weightCapacity: 42000, status: 'MAINTENANCE', notes: null, createdAt: new Date(), updatedAt: new Date() },
  { id: 'mock-t4', companyId: 'mock-c', name: 'Ford F-Max', plateNumber: 'DEF-1111', weightCapacity: 38000, status: 'AVAILABLE', notes: null, createdAt: new Date(), updatedAt: new Date() },
];

export const MOCK_DRIVERS: Driver[] = [
  { id: 'mock-d1', companyId: 'mock-c', name: 'Marcus Johnson', phone: '555-0101', licenseNumber: 'DL-123456', status: 'AVAILABLE', notes: null, createdAt: new Date(), updatedAt: new Date() },
  { id: 'mock-d2', companyId: 'mock-c', name: 'Sarah Connor', phone: '555-0102', licenseNumber: 'DL-987654', status: 'ON_TRIP', notes: null, createdAt: new Date(), updatedAt: new Date() },
  { id: 'mock-d3', companyId: 'mock-c', name: 'David Chen', phone: '555-0103', licenseNumber: 'DL-555555', status: 'OFF_DUTY', notes: null, createdAt: new Date(), updatedAt: new Date() },
];
