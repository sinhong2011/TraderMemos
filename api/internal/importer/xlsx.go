package importer

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"fmt"
	"io"
	"sort"
	"strconv"
	"strings"
)

// readXLSXSheet extracts the first worksheet of an .xlsx workbook as a string
// grid. It reads the two parts MetaTrader reports actually use — shared
// strings and the sheet XML — instead of pulling in a full spreadsheet
// library. Formulas, styles, and merged-cell metadata are ignored; each cell
// yields its stored value (shared/inline strings, or the raw numeric text).
func readXLSXSheet(data []byte) ([][]string, error) {
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, err
	}
	files := map[string]*zip.File{}
	var sheetNames []string
	for _, f := range zr.File {
		files[f.Name] = f
		if strings.HasPrefix(f.Name, "xl/worksheets/") && strings.HasSuffix(f.Name, ".xml") {
			sheetNames = append(sheetNames, f.Name)
		}
	}
	if len(sheetNames) == 0 {
		return nil, fmt.Errorf("xlsx: no worksheets")
	}
	sort.Strings(sheetNames) // sheet1.xml first

	var shared []string
	if f, ok := files["xl/sharedStrings.xml"]; ok {
		shared, err = parseSharedStrings(f)
		if err != nil {
			return nil, err
		}
	}
	f := files[sheetNames[0]]
	rc, err := f.Open()
	if err != nil {
		return nil, err
	}
	defer rc.Close()
	return parseWorksheet(rc, shared)
}

// parseSharedStrings flattens each <si> (plain <t> or rich-text runs) to a string.
func parseSharedStrings(f *zip.File) ([]string, error) {
	rc, err := f.Open()
	if err != nil {
		return nil, err
	}
	defer rc.Close()
	dec := xml.NewDecoder(rc)
	var out []string
	var cur strings.Builder
	inSI, inT := false, false
	for {
		tok, err := dec.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		switch t := tok.(type) {
		case xml.StartElement:
			switch t.Name.Local {
			case "si":
				inSI = true
				cur.Reset()
			case "t":
				inT = inSI
			}
		case xml.CharData:
			if inT {
				cur.Write(t)
			}
		case xml.EndElement:
			switch t.Name.Local {
			case "t":
				inT = false
			case "si":
				out = append(out, cur.String())
				inSI = false
			}
		}
	}
	return out, nil
}

func parseWorksheet(r io.Reader, shared []string) ([][]string, error) {
	dec := xml.NewDecoder(r)
	var grid [][]string
	var row []string
	var cellType, cellRef string
	var cellVal strings.Builder
	inV := false
	for {
		tok, err := dec.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		switch t := tok.(type) {
		case xml.StartElement:
			switch t.Name.Local {
			case "row":
				row = nil
			case "c":
				cellType, cellRef = "", ""
				cellVal.Reset()
				for _, a := range t.Attr {
					switch a.Name.Local {
					case "t":
						cellType = a.Value
					case "r":
						cellRef = a.Value
					}
				}
			case "v", "t":
				inV = true
			}
		case xml.CharData:
			if inV {
				cellVal.Write(t)
			}
		case xml.EndElement:
			switch t.Name.Local {
			case "v", "t":
				inV = false
			case "c":
				val := cellVal.String()
				if cellType == "s" {
					if i, err := strconv.Atoi(strings.TrimSpace(val)); err == nil && i >= 0 && i < len(shared) {
						val = shared[i]
					}
				}
				// Place by column letter so sparse rows stay aligned.
				col := columnIndex(cellRef)
				if col < 0 {
					col = len(row)
				}
				for len(row) <= col {
					row = append(row, "")
				}
				row[col] = val
			case "row":
				grid = append(grid, row)
			}
		}
	}
	return grid, nil
}

// columnIndex converts a cell reference ("BC12") to its 0-based column (54).
func columnIndex(ref string) int {
	n := 0
	seen := false
	for i := 0; i < len(ref); i++ {
		c := ref[i]
		if c >= 'A' && c <= 'Z' {
			n = n*26 + int(c-'A') + 1
			seen = true
			continue
		}
		break
	}
	if !seen {
		return -1
	}
	return n - 1
}
