import {test, expect } from '@playwright/test';

test.describe('Login Tests', () => {
  test('should login successfully with valid credentials', async ({ page }) => {

    await page.goto('http://localhost:5173/');

    await page.getByRole('button', {name: 'Iniciar sesión', exact: true}).click();

    await expect(page).toHaveURL("/auth");

    await page.getByLabel('Email').fill('joao.pereira@nomerenta.com');
    await page.getByLabel('Contraseña', {exact: true}).fill('GatitoMono');

    await page.locator('form').getByRole('button', { name: 'Iniciar sesión', exact: true }).click();


    await expect(page).toHaveURL("/home");
  });
});
