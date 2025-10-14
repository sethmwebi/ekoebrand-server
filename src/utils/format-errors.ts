import { ZodError, ZodIssue } from "zod";

const formatZodIssue = (issue: ZodIssue): string => {
  const { path, message } = issue;
  const pathString = path.join(".");

  return `${pathString}: ${message}`;
};

// Format the Zod error message with only the current error
export const formatZodError = (error: ZodError): string[] => {
  const { issues } = error;
  const errors = [];
  for (let i = 0; i < issues.length; i++) {
    errors.push(formatZodIssue(issues[i]));
  }
  return errors;
};
