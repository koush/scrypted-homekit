import { ScryptedDevice } from "@scrypted/sdk";
import { uuid, Accessory } from "hap-nodejs";

export function makeAccessory(device: ScryptedDevice): Accessory {
    return new Accessory(device.name, uuid.generate(device.id));
}