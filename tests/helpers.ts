import { FilizDB } from '../src/data/db'
import { Repository, uid } from '../src/data/repo'

/** Her test için benzersiz isimli, temiz bir sahip veritabanı */
export function freshRepo(name = `test-${uid()}`): Repository {
  return new Repository(new FilizDB(name), 'device-A', 'owner')
}

/** Bir veritabanının tüm içeriğinin anlık görüntüsü (karşılaştırma için) */
export async function snapshot(repo: Repository) {
  const file = await repo.exportAll()
  return JSON.stringify(file.tables)
}
