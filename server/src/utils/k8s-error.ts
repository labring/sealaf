/**
 * Format k8s error information for debugging and logging
 * @param error - Error object thrown by k8s operations
 * @returns Formatted error details object
 */
export function formatK8sError(error: any) {
  return {
    message: error.message,
    statusCode: error.response?.statusCode,
    statusText: error.response?.statusText,
    body: error.response?.body,
    reason: error.response?.body?.reason,
    code: error.response?.body?.code,
    details: error.response?.body?.details,
    stack: error.stack,
  }
}

/**
 * Format k8s error as JSON string for log output
 * @param error - Error object thrown by k8s operations
 * @returns Formatted JSON string
 */
export function formatK8sErrorAsJson(error: any): string {
  return JSON.stringify(formatK8sError(error), null, 2)
}
