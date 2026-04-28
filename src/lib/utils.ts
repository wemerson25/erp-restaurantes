import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(date));
}

export function formatCPF(cpf: string): string {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export function calcularINSS(salario: number): number {
  if (salario <= 1518.0) return salario * 0.075;
  if (salario <= 2793.88) return salario * 0.09;
  if (salario <= 4190.83) return salario * 0.12;
  if (salario <= 8157.41) return salario * 0.14;
  return 8157.41 * 0.14;
}

export function calcularIRRF(baseCalculo: number): number {
  if (baseCalculo <= 2259.2) return 0;
  if (baseCalculo <= 2826.65) return baseCalculo * 0.075 - 169.44;
  if (baseCalculo <= 3751.05) return baseCalculo * 0.15 - 381.44;
  if (baseCalculo <= 4664.68) return baseCalculo * 0.225 - 662.77;
  return baseCalculo * 0.275 - 896.0;
}

export function calcularFGTS(salarioBruto: number): number {
  return salarioBruto * 0.08;
}
