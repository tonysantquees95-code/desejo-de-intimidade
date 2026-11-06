/**
 * Kysely sobre o D1 (SQLite do Cloudflare), no lugar do Postgres do Floot.
 *
 * O código da loja foi escrito para o Postgres, que devolve datas como Date, booleanos como true/false
 * e colunas jsonb como objetos. O SQLite guarda texto e números; aqui a conversão é feita nos dois sentidos:
 * - ao gravar: Date vira texto ISO, true/false vira 1/0, objeto/lista vira JSON;
 * - ao ler: colunas de data voltam como Date, as de sim/não como boolean, as de JSON como objeto.
 *
 * O D1 não tem transação interativa: db.transaction() roda os comandos em sequência, sem desfazer em caso de erro.
 */
import {
  CompiledQuery,
  DatabaseConnection,
  DatabaseIntrospector,
  Dialect,
  Driver,
  Kysely,
  QueryCompiler,
  QueryResult,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
  DialectAdapter,
} from "kysely";

type D1Like = {
  prepare(sql: string): { bind(...v: unknown[]): { all(): Promise<{ results?: Record<string, unknown>[]; meta?: { changes?: number; last_row_id?: number } }> } };
};

const DATAS = new Set([
  "quando", "criado", "atualizado", "instagram_em", "whatsapp_em", "pausado_ate", "data",
]);
const SIM_NAO = new Set(["active", "ok", "stock_reserved", "visible", "enquete", "success", "sold_out"]);
const JSONS = new Set(["shipping_address", "corpo", "assinatura", "mensagens", "vetor"]);
const ISO = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

function paraBanco(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v === undefined) return null;
  if (v !== null && typeof v === "object" && !(v instanceof ArrayBuffer) && !ArrayBuffer.isView(v)) return JSON.stringify(v);
  return v;
}

function doBanco(chave: string, v: unknown): unknown {
  if (v === null || v === undefined) return v ?? null;
  if (typeof v === "string" && (DATAS.has(chave) || chave.endsWith("_at")) && ISO.test(v)) {
    const d = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(v) || v.length <= 10 ? v.replace(" ", "T") : v.replace(" ", "T") + "Z");
    return Number.isNaN(d.getTime()) ? v : d;
  }
  if (SIM_NAO.has(chave) && typeof v === "number") return v !== 0;
  if (JSONS.has(chave) && typeof v === "string" && /^[\[{"]/.test(v)) {
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }
  return v;
}

function converterLinha(linha: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(linha)) out[k] = doBanco(k, linha[k]);
  return out;
}

class ConexaoD1 implements DatabaseConnection {
  constructor(private readonly banco: () => D1Like) {}
  async executeQuery<R>(q: CompiledQuery): Promise<QueryResult<R>> {
    const params = q.parameters.map(paraBanco);
    let res;
    try {
      res = await this.banco().prepare(q.sql).bind(...params).all();
    } catch (e) {
      console.error("D1:", (e as Error).message, "\nSQL:", q.sql);
      throw e;
    }
    const linhas = (res.results ?? []).map(converterLinha) as R[];
    const changes = res.meta?.changes ?? 0;
    return {
      rows: linhas,
      numAffectedRows: BigInt(changes),
      insertId: res.meta?.last_row_id !== undefined ? BigInt(res.meta.last_row_id) : undefined,
    } as QueryResult<R>;
  }
  async *streamQuery<R>(q: CompiledQuery): AsyncIterableIterator<QueryResult<R>> {
    yield await this.executeQuery<R>(q);
  }
}

class DriverD1 implements Driver {
  constructor(private readonly banco: () => D1Like) {}
  async init() {}
  async acquireConnection() {
    return new ConexaoD1(this.banco);
  }
  async beginTransaction() {}
  async commitTransaction() {}
  async rollbackTransaction() {
    console.warn("D1: transação com erro; os comandos anteriores já foram gravados.");
  }
  async releaseConnection() {}
  async destroy() {}
}

/** Adaptador SQLite que deixa db.transaction() funcionar (sem atomicidade). */
class AdaptadorD1 extends SqliteAdapter {
  override get supportsTransactionalDdl() {
    return false;
  }
}

export class DialetoD1 implements Dialect {
  constructor(private readonly banco: () => D1Like) {}
  createAdapter(): DialectAdapter {
    return new AdaptadorD1();
  }
  createDriver(): Driver {
    return new DriverD1(this.banco);
  }
  createQueryCompiler(): QueryCompiler {
    return new SqliteQueryCompiler();
  }
  createIntrospector(db: Kysely<any>): DatabaseIntrospector {
    return new SqliteIntrospector(db);
  }
}
