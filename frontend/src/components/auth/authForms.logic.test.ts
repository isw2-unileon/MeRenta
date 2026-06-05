import { describe, expect, it } from "vitest";

import {
  normalizeLoginPayload,
  normalizeRegisterPayload,
  validateLogin,
  validateRegister,
} from "./authForms.logic";

describe("authForms logic", () => {
  it("validates login required fields and normalizes credentials", () => {
    expect(validateLogin({ email: " ", password: "secret" })).toBe("El email es requerido");
    expect(validateLogin({ email: "user@example.com", password: "" })).toBe("La contraseÃ±a es requerida");
    expect(validateLogin({ email: " user@example.com ", password: "secret" })).toBe("");
    expect(normalizeLoginPayload({ email: " user@example.com ", password: "secret" })).toEqual({
      email: "user@example.com",
      password: "secret",
    });
  });

  it("validates registration fields in user-facing order", () => {
    expect(
      validateRegister({
        firstName: "",
        lastName: "Garcia",
        email: "user@example.com",
        password: "password1",
        repeatPassword: "password1",
      })
    ).toBe("El nombre es requerido");

    expect(
      validateRegister({
        firstName: "Lucia",
        lastName: "Garcia",
        email: "",
        password: "password1",
        repeatPassword: "password1",
      })
    ).toBe("El email es requerido");

    expect(
      validateRegister({
        firstName: "Lucia",
        lastName: "Garcia",
        email: "user@example.com",
        password: "short",
        repeatPassword: "short",
      })
    ).toBe("La contraseÃ±a debe tener al menos 8 caracteres");

    expect(
      validateRegister({
        firstName: "Lucia",
        lastName: "Garcia",
        email: "user@example.com",
        password: "password1",
        repeatPassword: "password2",
      })
    ).toBe("Las contraseÃ±as no coinciden");
  });

  it("normalizes registration payloads before calling the auth API", () => {
    expect(
      normalizeRegisterPayload({
        firstName: " Lucia ",
        lastName: " Garcia ",
        email: " user@example.com ",
        password: "password1",
        repeatPassword: "password1",
      })
    ).toEqual({
      first_name: "Lucia",
      last_name: "Garcia",
      email: "user@example.com",
      password: "password1",
      confirm_password: "password1",
    });
  });
});
