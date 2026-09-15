import { hingePlatform } from "./hinge";
import { simulatedPlatform } from "./simulated";
import type { DatingPlatform } from "./types";

/** PLATFORM=hinge switches the agents from the simulator to the real app via the sidecar. */
export function getPlatform(): DatingPlatform {
  return process.env.PLATFORM?.toLowerCase() === "hinge" ? hingePlatform : simulatedPlatform;
}
