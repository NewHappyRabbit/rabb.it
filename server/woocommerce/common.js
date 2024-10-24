export async function retry(fn, timesLeft = 10, timeout = 5000) {
    try {
        if (timesLeft === 0) return;
        await fn();
    } catch (error) {
        // Invalid request, for 4xx and 5xx statuses
        console.error("Response Status:", error.response.status);
        console.error("Response Headers:", error.response.headers);
        console.error("Response Data:", error.response.data);
        await new Promise(resolve => setTimeout(resolve, timeout));
        retry(fn, timesLeft - 1);
    }
}