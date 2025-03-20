import { Project, SyntaxKind, Type } from 'ts-morph'

export interface ParsedClass {
  className: string
  gettableProperties: {
    name: string
    type: string
  }[]
  settableProperties: {
    name: string
    type: string
  }[]
  methods: {
    name: string
    parameters: {
      name: string
      type: string // e.g. "string", "number", "MyEnum", "any", "('Session' | 'Arranger')"
    }[]
  }[]
}

/**
 * Minimally classify a type as "string", "number", "boolean", "literal-union", "enum", or "any".
 * If it’s a literal union, we store something like "('Session' | 'Arranger' | ...)".
 * If it’s an enum, we store the enum name (like "NavDirection").
 */
function classifyType(type: Type): string {
  if (type.isEnum() || type.isEnumLiteral()) {
    // Just store the symbol name if possible
    const sym = type.getSymbol()
    return sym ? sym.getName() : 'enum'
  }

  // If it’s a union of literal types (e.g. 'Session' | 'Arranger')
  if (type.isUnion()) {
    const unionTypes = type.getUnionTypes()
    if (unionTypes.every(t => t.isLiteral())) {
      const vals = unionTypes.map(t => {
        const lit = t.getLiteralValue()
        return typeof lit === 'string' ? `'${lit}'` : String(lit)
      })
      return `(${vals.join(' | ')})`
    }
    return 'any'
  }

  // If it’s a single literal (e.g. 'Session')
  if (type.isLiteral()) {
    const val = type.getLiteralValue()
    if (typeof val === 'string') {
      return `'${val}'`
    }
    return String(val)
  }

  if (type.isString()) return 'string'
  if (type.isNumber()) return 'number'
  if (type.isBoolean()) return 'boolean'

  return 'any'
}

/**
 * Parses the .d.ts files in the given directory (e.g. "ns") for classes that extend `Namespace<...>`,
 * and extracts gettable/settable props plus instance methods.
 */
export function parseAbletonSource(abletonJsPath: string): ParsedClass[] {
  const project = new Project({
    skipFileDependencyResolution: true,
    skipAddingFilesFromTsConfig: true
  })

  // Load all .d.ts files
  project.addSourceFilesAtPaths(`${abletonJsPath}/**/*.d.ts`)

  const parsed: ParsedClass[] = []
  const sourceFiles = project.getSourceFiles()

  for (const sf of sourceFiles) {
    const classes = sf.getClasses()
    for (const cls of classes) {
      const heritage = cls.getExtends()
      if (!heritage) continue
      const heritageText = heritage.getText()
      // We only care about classes that extend `Namespace<...>`
      if (!heritageText.includes('Namespace<')) continue

      const className = cls.getName() ?? 'UnknownClass'

      // Prepare placeholders for the collected data
      let gettableProps: { name: string; type: string }[] = []
      let settableProps: { name: string; type: string }[] = []
      let methods: {
        name: string
        parameters: { name: string; type: string }[]
      }[] = []

      // We'll search for the interface declarations named `GettableProperties` and `SettableProperties`.
      const fileStatements = sf.getStatements()

      const gettableIf = fileStatements.find(st => {
        return (
          st.getKind() === SyntaxKind.InterfaceDeclaration &&
          st.asKindOrThrow(SyntaxKind.InterfaceDeclaration).getName() === 'GettableProperties'
        )
      })
      if (gettableIf) {
        const intf = gettableIf.asKindOrThrow(SyntaxKind.InterfaceDeclaration)
        for (const member of intf.getMembers()) {
          if (member.getKind() !== SyntaxKind.PropertySignature) continue
          const propSig = member.asKindOrThrow(SyntaxKind.PropertySignature)

          const name = propSig.getName()
          const typeOfProp = classifyType(propSig.getType())
          gettableProps.push({ name, type: typeOfProp })
        }
      }

      const settableIf = fileStatements.find(st => {
        return (
          st.getKind() === SyntaxKind.InterfaceDeclaration &&
          st.asKindOrThrow(SyntaxKind.InterfaceDeclaration).getName() === 'SettableProperties'
        )
      })
      if (settableIf) {
        const intf = settableIf.asKindOrThrow(SyntaxKind.InterfaceDeclaration)
        for (const member of intf.getMembers()) {
          if (member.getKind() !== SyntaxKind.PropertySignature) continue
          const propSig = member.asKindOrThrow(SyntaxKind.PropertySignature)

          const name = propSig.getName()
          const typeOfProp = classifyType(propSig.getType())
          settableProps.push({ name, type: typeOfProp })
        }
      }

      // Now parse instance methods
      for (const method of cls.getInstanceMethods()) {
        const mName = method.getName()
        // skip the standard ones we don't want
        if (['constructor', 'get', 'set', 'addListener', 'sendCommand'].includes(mName)) {
          continue
        }

        // Gather parameter types
        const parameters = method.getParameters().map(param => {
          const paramName = param.getName()
          const t = param.getType()
          const c = classifyType(t)
          return { name: paramName, type: c }
        })

        methods.push({ name: mName, parameters })
      }

      parsed.push({
        className,
        gettableProperties: gettableProps,
        settableProperties: settableProps,
        methods
      })
    }
  }

  return parsed
}
