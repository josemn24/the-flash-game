import type { Database } from "./database.types";

type PublicFunctions = Database["public"]["Functions"];

export type PublicFunctionName = keyof PublicFunctions & string;

export type PublicFunctionArgs<Name extends PublicFunctionName> = Name extends PublicFunctionName
  ? PublicFunctions[Name] extends { Args: infer Args }
    ? Args
    : never
  : never;

export type PublicFunctionReturns<Name extends PublicFunctionName> = Name extends PublicFunctionName
  ? PublicFunctions[Name] extends { Returns: infer Returns }
    ? Returns
    : never
  : never;

export type PublicFunctionReturn<Name extends PublicFunctionName> = PublicFunctionReturns<Name>;

export type PublicFunctionRow<Name extends PublicFunctionName> =
  PublicFunctionReturn<Name> extends readonly (infer Row)[] ? Row : never;

export type PublicFunctionInput<Name extends PublicFunctionName> =
  PublicFunctionArgs<Name> extends {
    input: infer Input;
  }
    ? Input
    : never;

export type RawRpcResponse<Response extends { data: unknown }> = Omit<Response, "data"> & {
  data: unknown;
};
