export function zodErrors(issues) {
  return issues.map(issue => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}
