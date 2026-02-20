import { is, assert, validate, ValidationError } from "@typesugar/validate";
interface User {
    id: number;
    name: string;
    active?: boolean;
}
const isUser = is<User>();
const assertUser = assert<User>();
const validateUser = validate<User>();
