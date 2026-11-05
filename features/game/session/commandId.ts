import { randomUuid } from "@/lib/randomUuid";

export const createSessionCommandId = (operation: string) => `${operation}:${randomUuid()}`;
