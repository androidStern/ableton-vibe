import fs from 'fs'
import path from 'path'
import { parseAbletonSource, ParsedClass } from './parse-ableton'

interface FinalMapEntry {
  gettableProperties: Array<{ name: string; type: string }>
  settableProperties: Array<{ name: string; type: string }>
  methods: Array<{
    name: string
    parameters: Array<{ name: string; type: string }>
  }>
}

function generateMapFile(parsedClasses: ParsedClass[]) {
  const finalMap: Record<string, FinalMapEntry> = {}

  for (const cls of parsedClasses) {
    finalMap[cls.className] = {
      gettableProperties: cls.gettableProperties,
      settableProperties: cls.settableProperties,
      methods: cls.methods.map(m => ({
        name: m.name,
        parameters: m.parameters.map(p => ({
          name: p.name,
          type: p.type
        }))
      }))
    }
  }

  const mapJson = JSON.stringify(finalMap, null, 2)

  return `// AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY.
export const abletonApiMap = ${mapJson} as const;
`
}

async function getAbletonJsPath() {
  try {
    const abletonJsMainPath = await import.meta.resolve('ableton-js')
    const fileUrl = new URL(abletonJsMainPath)
    const filePath = fileUrl.pathname
    const packageDir = path.dirname(filePath)
    return path.join(packageDir, 'ns')
  } catch (error) {
    console.error(error)
    throw new Error('Could not resolve ableton-js package')
  }
}

;(async () => {
  fs.mkdirSync('generated', { recursive: true })

  const abletonJsSourcePath = await getAbletonJsPath()
  console.log('Looking for files at:', abletonJsSourcePath)
  console.log('All files in the directory:')
  fs.readdirSync(abletonJsSourcePath).forEach(file => {
    console.log(`- ${file}`)
  })

  const parsed = parseAbletonSource(abletonJsSourcePath)
  console.log('Found classes:', parsed.length)

  const output = generateMapFile(parsed)
  fs.writeFileSync('generated/abletonApiMap.ts', output, 'utf8')
  console.log('abletonApiMap.ts generated successfully!')
})()
