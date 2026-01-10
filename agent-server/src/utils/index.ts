/**
 * Sleeps for a given time in milliseconds.
 * 
 * @param ms Number of milliseconds to sleep
 * @returns Promise<void>
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => {
        setTimeout(() => resolve(), ms);
    });
}