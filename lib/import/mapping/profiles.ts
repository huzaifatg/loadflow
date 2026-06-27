// ─── Mapping Engine — Built-in Entity Profiles ───────────────────────────────
// Canonical LoadFlow field definitions for each importable entity.
// These are the authoritative domain field definitions derived from the Prisma schema.
// The mapping engine does NOT import from Prisma — these are independent definitions.

import type { EntityDefinition } from './types';

/**
 * Delivery entity definition.
 * Mirrors the Prisma `Delivery` model fields relevant to import.
 */
export const DELIVERY_ENTITY: EntityDefinition = {
  entityName: 'delivery',
  label: 'Delivery',
  fields: [
    {
      name: 'customerName',
      label: 'Customer Name',
      dataType: 'string',
      required: true,
      aliases: [
        'customer', 'client', 'client_name', 'recipient',
        'recipient_name', 'consignee', 'buyer', 'buyer_name',
        'ship_to', 'ship_to_name', 'deliver_to',
      ],
    },
    {
      name: 'pickupAddress',
      label: 'Pickup Address',
      dataType: 'string',
      required: true,
      aliases: [
        'pickup', 'origin', 'origin_address', 'from', 'from_address',
        'sender_address', 'ship_from', 'warehouse', 'warehouse_address',
        'collection_address', 'source_address',
      ],
    },
    {
      name: 'deliveryAddress',
      label: 'Delivery Address',
      dataType: 'string',
      required: true,
      aliases: [
        'delivery', 'destination', 'destination_address', 'to',
        'to_address', 'address', 'drop_off', 'dropoff',
        'ship_to_address', 'deliver_to_address', 'drop_address',
      ],
    },
    {
      name: 'weight',
      label: 'Weight',
      dataType: 'decimal',
      required: false,
      aliases: [
        'total_weight', 'gross_weight', 'net_weight', 'package_weight',
        'shipment_weight', 'cargo_weight', 'load_weight', 'wt',
      ],
    },
    {
      name: 'scheduledDate',
      label: 'Scheduled Date',
      dataType: 'date',
      required: false,
      aliases: [
        'scheduled', 'date', 'delivery_date', 'ship_date',
        'pickup_date', 'due_date', 'expected_date', 'eta',
        'estimated_delivery', 'planned_date',
      ],
    },
    {
      name: 'notes',
      label: 'Notes',
      dataType: 'string',
      required: false,
      aliases: [
        'note', 'comments', 'comment', 'remarks', 'remark',
        'instructions', 'special_instructions', 'description',
        'memo', 'info', 'additional_info',
      ],
    },
    {
      name: 'externalId',
      label: 'External ID',
      dataType: 'string',
      required: false,
      aliases: [
        'external_id', 'ext_id', 'reference', 'ref', 'reference_number',
        'ref_number', 'order_id', 'order_number', 'tracking',
        'tracking_number', 'shipment_id', 'po_number', 'po',
      ],
    },
    {
      name: 'status',
      label: 'Status',
      dataType: 'enum',
      required: false,
      aliases: [
        'delivery_status', 'order_status', 'shipment_status', 'state',
      ],
    },
  ],
};

/**
 * Driver entity definition.
 */
export const DRIVER_ENTITY: EntityDefinition = {
  entityName: 'driver',
  label: 'Driver',
  fields: [
    {
      name: 'name',
      label: 'Name',
      dataType: 'string',
      required: true,
      aliases: [
        'driver_name', 'full_name', 'driver', 'first_name',
      ],
    },
    {
      name: 'phone',
      label: 'Phone',
      dataType: 'string',
      required: false,
      aliases: [
        'phone_number', 'mobile', 'cell', 'telephone', 'contact',
        'contact_number',
      ],
    },
    {
      name: 'licenseNumber',
      label: 'License Number',
      dataType: 'string',
      required: false,
      aliases: [
        'license', 'licence', 'license_no', 'licence_number',
        'dl_number', 'driving_license',
      ],
    },
    {
      name: 'notes',
      label: 'Notes',
      dataType: 'string',
      required: false,
      aliases: ['note', 'comments', 'remarks', 'description'],
    },
  ],
};

/**
 * Truck entity definition.
 */
export const TRUCK_ENTITY: EntityDefinition = {
  entityName: 'truck',
  label: 'Truck',
  fields: [
    {
      name: 'name',
      label: 'Name',
      dataType: 'string',
      required: true,
      aliases: [
        'truck_name', 'vehicle_name', 'vehicle', 'truck',
      ],
    },
    {
      name: 'type',
      label: 'Type',
      dataType: 'string',
      required: false,
      aliases: [
        'truck_type', 'vehicle_type', 'category',
      ],
    },
    {
      name: 'plateNumber',
      label: 'Plate Number',
      dataType: 'string',
      required: true,
      aliases: [
        'plate', 'license_plate', 'plate_no', 'registration',
        'registration_number', 'reg_number', 'vin',
      ],
    },
    {
      name: 'weightCapacity',
      label: 'Weight Capacity',
      dataType: 'decimal',
      required: true,
      aliases: [
        'capacity', 'max_weight', 'load_capacity', 'payload',
        'max_load', 'weight_limit',
      ],
    },
    {
      name: 'notes',
      label: 'Notes',
      dataType: 'string',
      required: false,
      aliases: ['note', 'comments', 'remarks', 'description'],
    },
  ],
};

/** Registry of all built-in entity definitions. */
const ENTITY_REGISTRY: Map<string, EntityDefinition> = new Map([
  [DELIVERY_ENTITY.entityName, DELIVERY_ENTITY],
  [DRIVER_ENTITY.entityName, DRIVER_ENTITY],
  [TRUCK_ENTITY.entityName, TRUCK_ENTITY],
]);

/** Get an entity definition by name. */
export function getEntityDefinition(name: string): EntityDefinition | undefined {
  return ENTITY_REGISTRY.get(name);
}

/** Get all registered entity names. */
export function getRegisteredEntityNames(): string[] {
  return Array.from(ENTITY_REGISTRY.keys());
}
