import type { IEMbaseItem } from "@/app/study/recon4imd/recruitment-explorer/[[...collaborator]]/types/iem-explorer-types";
import { SHOW_ALL_HEALTHCARE_PROVIDERS, parseCollaborators } from "@/app/study/recon4imd/recruitment-explorer/[[...collaborator]]/types/constants";
import { normalizedStatus } from "@/app/study/recon4imd/recruitment-explorer/[[...collaborator]]/utils/RecruitmentStatus";

describe("Recruitment Explorer - Filtering Logic", () => {
  const createMockIMD = (overrides: Partial<IEMbaseItem> = {}): IEMbaseItem => ({
    id: 1,
    name: "Test IMD",
    iembase_name: "test",
    code: "T001",
    gene_symbol: "TEST",
    alternative_names: null,
    icimd_category: "Test Category",
    icimd_subcategory: null,
    recruitment_target: 10,
    recruited_count: 5,
    imd_status: "prescribed",
    number_of_collaborators: 1,
    collaborators: "{UMC Utrecht}",
    targeted_urine: null,
    global_plasma_complementary: null,
    targeted_plasma: null,
    global_plasma: null,
    metabolite_biomarkers: null,
    icimd_no: 1,
    omim_url: null,
    iembase_url: null,
    formatted_category_header: null,
    category_count: null,
    category_row_number: null,
    draft: false,
    soft_delete: false,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  });

  describe("Status Filter Logic", () => {
    const testData: IEMbaseItem[] = [
      createMockIMD({ id: 1, imd_status: "prescribed", name: "Prescribed IMD 1" }),
      createMockIMD({ id: 2, imd_status: "flexible", name: "Flexible IMD 1" }),
      createMockIMD({ id: 3, imd_status: "prescribed", name: "Prescribed IMD 2" }),
      createMockIMD({ id: 4, imd_status: "flexible", name: "Flexible IMD 2" }),
    ];

    it("filters prescribed items when prescribed filter is false", () => {
      const statusFilter = { prescribed: false, flexible: true };
      
      const filtered = testData.filter((item) => {
        const status = normalizedStatus(item.imd_status);
        if (!statusFilter.prescribed && status === "prescribed") return false;
        if (!statusFilter.flexible && status === "flexible") return false;
        return true;
      });

      expect(filtered).toHaveLength(2);
      expect(filtered.every(item => normalizedStatus(item.imd_status) === "flexible")).toBe(true);
    });

    it("filters flexible items when flexible filter is false", () => {
      const statusFilter = { prescribed: true, flexible: false };
      
      const filtered = testData.filter((item) => {
        const status = normalizedStatus(item.imd_status);
        if (!statusFilter.prescribed && status === "prescribed") return false;
        if (!statusFilter.flexible && status === "flexible") return false;
        return true;
      });

      expect(filtered).toHaveLength(2);
      expect(filtered.every(item => normalizedStatus(item.imd_status) === "prescribed")).toBe(true);
    });

    it("shows all items when both filters are true", () => {
      const statusFilter = { prescribed: true, flexible: true };
      
      const filtered = testData.filter((item) => {
        const status = normalizedStatus(item.imd_status);
        if (!statusFilter.prescribed && status === "prescribed") return false;
        if (!statusFilter.flexible && status === "flexible") return false;
        return true;
      });

      expect(filtered).toHaveLength(4);
    });

    it("shows no items when both filters are false", () => {
      const statusFilter = { prescribed: false, flexible: false };
      
      const filtered = testData.filter((item) => {
        const status = normalizedStatus(item.imd_status);
        if (!statusFilter.prescribed && status === "prescribed") return false;
        if (!statusFilter.flexible && status === "flexible") return false;
        return true;
      });

      expect(filtered).toHaveLength(0);
    });
  });

  describe("Collaborator Filter Logic", () => {
    const testData: IEMbaseItem[] = [
      createMockIMD({ 
        id: 1, 
        imd_status: "prescribed", 
        collaborators: "{UMC Utrecht}",
        name: "UMC IMD"
      }),
      createMockIMD({ 
        id: 2, 
        imd_status: "prescribed", 
        collaborators: "{Radboudumc}",
        name: "Radboud IMD"
      }),
      createMockIMD({ 
        id: 3, 
        imd_status: "flexible", 
        collaborators: "{UMC Utrecht}",
        name: "Flexible IMD"
      }),
      createMockIMD({ 
        id: 4, 
        imd_status: "prescribed", 
        collaborators: "{UMC Utrecht,Radboudumc}",
        name: "Multi-collaborator IMD"
      }),
    ];

    it("shows all items when 'Show All Healthcare Providers' is selected", () => {
      const selectedCollaborator = SHOW_ALL_HEALTHCARE_PROVIDERS;
      
      const filtered = testData.filter((item) => {
        if (selectedCollaborator === SHOW_ALL_HEALTHCARE_PROVIDERS) return true;
        const collaboratorsList = parseCollaborators(item.collaborators);
        const status = normalizedStatus(item.imd_status);
        return status === "flexible" || collaboratorsList.includes(selectedCollaborator);
      });

      expect(filtered).toHaveLength(4);
    });

    it("filters by specific collaborator for prescribed items", () => {
      const selectedCollaborator: string = "UMC Utrecht";
      
      const filtered = testData.filter((item) => {
        if (selectedCollaborator === SHOW_ALL_HEALTHCARE_PROVIDERS) return true;
        const collaboratorsList = parseCollaborators(item.collaborators);
        const status = normalizedStatus(item.imd_status);
        return status === "flexible" || collaboratorsList.includes(selectedCollaborator);
      });

      // Should include: UMC IMD, Flexible IMD, Multi-collaborator IMD
      expect(filtered).toHaveLength(3);
      expect(filtered.find(item => item.id === 1)).toBeDefined(); // UMC IMD
      expect(filtered.find(item => item.id === 3)).toBeDefined(); // Flexible IMD
      expect(filtered.find(item => item.id === 4)).toBeDefined(); // Multi-collaborator IMD
    });

    it("always includes flexible items regardless of collaborator", () => {
      const selectedCollaborator: string = "Radboudumc";
      
      const filtered = testData.filter((item) => {
        if (selectedCollaborator === SHOW_ALL_HEALTHCARE_PROVIDERS) return true;
        const collaboratorsList = parseCollaborators(item.collaborators);
        const status = normalizedStatus(item.imd_status);
        return status === "flexible" || collaboratorsList.includes(selectedCollaborator);
      });

      // Should include: Radboud IMD, Flexible IMD, Multi-collaborator IMD
      expect(filtered).toHaveLength(3);
      expect(filtered.find(item => item.imd_status === "flexible")).toBeDefined();
    });

    it("handles multiple collaborators correctly", () => {
      
      const multiCollabItem = testData.find(item => item.id === 4);
      expect(multiCollabItem).toBeDefined();
      
      const collaboratorsList = parseCollaborators(multiCollabItem!.collaborators);
      expect(collaboratorsList).toContain("UMC Utrecht");
      expect(collaboratorsList).toContain("Radboudumc");
    });
  });

  describe("Search Filter Logic", () => {
    const testData: IEMbaseItem[] = [
      createMockIMD({ 
        id: 1, 
        name: "Phenylketonuria",
        iembase_name: "PKU",
        gene_symbol: "PAH",
        code: "E70.0"
      }),
      createMockIMD({ 
        id: 2, 
        name: "Maple Syrup Urine Disease",
        iembase_name: "MSUD",
        gene_symbol: "BCKDHA",
        code: "E71.0"
      }),
      createMockIMD({ 
        id: 3, 
        name: "Glycogen Storage Disease",
        iembase_name: "GSD",
        gene_symbol: "G6PC",
        code: "E74.01",
        metabolite_biomarkers: "glucose-6-phosphate"
      }),
    ];

    it("filters by name", () => {
      const searchTerm = "phenyl";
      
      const filtered = testData.filter((item) => {
        const term = searchTerm.toLowerCase();
        const blob = [
          item.name,
          item.iembase_name,
          item.gene_symbol,
          item.code,
        ].join(" ").toLowerCase();
        return blob.includes(term);
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe("Phenylketonuria");
    });

    it("filters by gene symbol", () => {
      const searchTerm = "PAH";
      
      const filtered = testData.filter((item) => {
        const term = searchTerm.toLowerCase();
        const blob = [
          item.name,
          item.iembase_name,
          item.gene_symbol,
          item.code,
        ].join(" ").toLowerCase();
        return blob.includes(term);
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].gene_symbol).toBe("PAH");
    });

    it("filters by code", () => {
      const searchTerm = "E71.0";
      
      const filtered = testData.filter((item) => {
        const term = searchTerm.toLowerCase();
        const blob = [
          item.name,
          item.iembase_name,
          item.gene_symbol,
          item.code,
        ].join(" ").toLowerCase();
        return blob.includes(term);
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].code).toBe("E71.0");
    });

    it("is case insensitive", () => {
      const searchTerm = "MAPLE";
      
      const filtered = testData.filter((item) => {
        const term = searchTerm.toLowerCase();
        const blob = [
          item.name,
          item.iembase_name,
          item.gene_symbol,
          item.code,
        ].join(" ").toLowerCase();
        return blob.includes(term);
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe("Maple Syrup Urine Disease");
    });

    it("matches partial strings", () => {
      const searchTerm = "syrup";
      
      const filtered = testData.filter((item) => {
        const term = searchTerm.toLowerCase();
        const blob = [
          item.name,
          item.iembase_name,
          item.gene_symbol,
          item.code,
        ].join(" ").toLowerCase();
        return blob.includes(term);
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toContain("Syrup");
    });

    it("returns empty array when no matches", () => {
      const searchTerm = "nonexistent";
      
      const filtered = testData.filter((item) => {
        const term = searchTerm.toLowerCase();
        const blob = [
          item.name,
          item.iembase_name,
          item.gene_symbol,
          item.code,
        ].join(" ").toLowerCase();
        return blob.includes(term);
      });

      expect(filtered).toHaveLength(0);
    });

    it("handles empty search term", () => {
      const searchTerm = "";
      
      const filtered = testData.filter((item) => {
        if (!searchTerm.trim()) return true;
        const term = searchTerm.toLowerCase();
        const blob = [
          item.name,
          item.iembase_name,
          item.gene_symbol,
          item.code,
        ].join(" ").toLowerCase();
        return blob.includes(term);
      });

      expect(filtered).toHaveLength(3);
    });

    it("filters by metabolite biomarkers when included in search blob", () => {
      const searchTerm = "glucose-6-phosphate";
      
      const filtered = testData.filter((item) => {
        const term = searchTerm.toLowerCase();
        const blob = [
          item.name,
          item.iembase_name,
          item.gene_symbol,
          item.code,
          item.metabolite_biomarkers ?? "",
        ].join(" ").toLowerCase();
        return blob.includes(term);
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].metabolite_biomarkers).toBe("glucose-6-phosphate");
    });
  });

  describe("Combined Filters Logic", () => {
    const testData: IEMbaseItem[] = [
      createMockIMD({ 
        id: 1, 
        name: "Phenylketonuria",
        imd_status: "prescribed",
        collaborators: "{UMC Utrecht}",
        gene_symbol: "PAH"
      }),
      createMockIMD({ 
        id: 2, 
        name: "Maple Syrup Urine Disease",
        imd_status: "flexible",
        collaborators: "{Radboudumc}",
        gene_symbol: "BCKDHA"
      }),
      createMockIMD({ 
        id: 3, 
        name: "Glycogen Storage Disease",
        imd_status: "prescribed",
        collaborators: "{Radboudumc}",
        gene_symbol: "G6PC"
      }),
    ];

    it("applies search and status filters together", () => {
      const searchTerm = "disease";
      const statusFilter = { prescribed: true, flexible: false };
      
      const filtered = testData.filter((item) => {
        // Status filter
        const status = normalizedStatus(item.imd_status);
        if (!statusFilter.prescribed && status === "prescribed") return false;
        if (!statusFilter.flexible && status === "flexible") return false;
        
        // Search filter
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          const blob = [item.name, item.gene_symbol].join(" ").toLowerCase();
          if (!blob.includes(term)) return false;
        }
        
        return true;
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe("Glycogen Storage Disease");
    });

    it("applies search, status, and collaborator filters together", () => {
      const searchTerm = "disease";
      const statusFilter = { prescribed: true, flexible: true };
      const selectedCollaborator: string = "Radboudumc";
      
      const filtered = testData.filter((item) => {
        // Status filter
        const status = normalizedStatus(item.imd_status);
        if (!statusFilter.prescribed && status === "prescribed") return false;
        if (!statusFilter.flexible && status === "flexible") return false;
        
        // Search filter
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          const blob = [item.name, item.gene_symbol].join(" ").toLowerCase();
          if (!blob.includes(term)) return false;
        }
        
        // Collaborator filter
        if (selectedCollaborator !== SHOW_ALL_HEALTHCARE_PROVIDERS) {
          const collaboratorsList = parseCollaborators(item.collaborators);
          if (!(status === "flexible" || collaboratorsList.includes(selectedCollaborator))) {
            return false;
          }
        }
        
        return true;

      });

      expect(filtered).toHaveLength(2);
      expect(filtered.map(item => item.id)).toEqual(expect.arrayContaining([2, 3]));
    });
  });

  describe("Category Grouping Logic", () => {
    const testData: IEMbaseItem[] = [
      createMockIMD({ 
        id: 1, 
        icimd_category: "Disorders of amino acid metabolism" 
      }),
      createMockIMD({ 
        id: 2, 
        icimd_category: "Disorders of amino acid metabolism" 
      }),
      createMockIMD({ 
        id: 3, 
        icimd_category: "Disorders of carbohydrate metabolism" 
      }),
      createMockIMD({ 
        id: 4, 
        icimd_category: null 
      }),
    ];

    it("groups items by category", () => {
      const grouped: Record<string, IEMbaseItem[]> = {};
      
      testData.forEach((item) => {
        const key = item.icimd_category || "Other Categories";
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(item);
      });

      expect(Object.keys(grouped)).toHaveLength(3);
      expect(grouped["Disorders of amino acid metabolism"]).toHaveLength(2);
      expect(grouped["Disorders of carbohydrate metabolism"]).toHaveLength(1);
      expect(grouped["Other Categories"]).toHaveLength(1);
    });

    it("creates unique categories", () => {
      const categorySet = new Set(
        testData.map(item => item.icimd_category || "Other Categories")
      );

      expect(categorySet.size).toBe(3);
    });
  });
});
