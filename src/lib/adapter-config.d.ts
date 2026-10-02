// This file extends the AdapterConfig type from "@iobroker/types"

// Augment the globally declared type ioBroker.AdapterConfig
declare global {
    namespace ioBroker {
        interface AdapterConfig {
            /** Address of the device (IP or host name) */
            ip: string;
            /** Port of the device */
            port: number;
            /** Token shown at the display of the device; empty = read only */
            token: string;
            /** Messages of the device are forwarded to the ioBroker log from this level: E, W, I, D, V or off */
            forwardLevel: string;
            /** Number of messages kept in messages.history */
            historySize: number;
            /** Notifications through a messaging adapter on/off */
            notifyEnabled: boolean;
            /** Messaging instance, e.g. "telegram.0" */
            messagingInstance: string;
            /** Notify about beginning and end of the storm protection */
            notifyStorm: boolean;
            /** Notify about faults (runtime of a drive, switching outputs) */
            notifyFault: boolean;
            /** Notify when the wind sensor stops answering or answers again */
            notifyWind: boolean;
            /** Notify when the sun sensor reports a fault or works again */
            notifySensor: boolean;
            /** Notify when the device is not reachable for a while or reachable again */
            notifyConnection: boolean;
            /** Notify when the device has restarted */
            notifyRestart: boolean;
            /** Minutes without connection before the notification is sent */
            notifyConnectionMinutes: number;
        }
    }
}

// this is required so the above AdapterConfig is found by TypeScript / type checking
export {};
