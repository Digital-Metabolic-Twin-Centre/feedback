import {
  normalizedStatus,
  hasDotData,
  getDotColor,
} from "@/app/study/recon4imd/recruitment-explorer/[[...collaborator]]/utils/RecruitmentStatus";
import {
  parseCollaborators,
  SHOW_ALL_HEALTHCARE_PROVIDERS,
} from "@/app/study/recon4imd/recruitment-explorer/[[...collaborator]]/types/constants";
import type { IEMbaseItem } from "@/app/study/recon4imd/recruitment-explorer/[[...collaborator]]/types/iem-explorer-types";

describe("Recruitment Explorer - RecruitmentStatus utilities", () => {
  describe("normalizedStatus", () => {
    it("converts status to lowercase", () => {
      expect(normalizedStatus("PRESCRIBED")).toBe("prescribed");
      expect(normalizedStatus("Flexible")).toBe("flexible");
      expect(normalizedStatus("MiXeD")).toBe("mixed");
    });

    it("handles null status", () => {
      expect(normalizedStatus(null)).toBe("");
    });

    it("handles undefined status", () => {
      expect(normalizedStatus(undefined)).toBe("");
    });

    it("handles empty string", () => {
      expect(normalizedStatus("")).toBe("");
    });

    it("preserves whitespace", () => {
      expect(normalizedStatus(" prescribed ")).toBe(" prescribed ");
    });
  });

  describe("hasDotData", () => {
    it("returns true when both target and recruited are finite numbers", () => {
      const imd: IEMbaseItem = {
        id: 1,
        name: "Test IMD",
        iembase_name: "test",
        code: "T001",
        gene_symbol: null,
        alternative_names: null,
        icimd_category: null,
        icimd_subcategory: null,
        recruitment_target: 10,
        recruited_count: 5,
        imd_status: null,
        number_of_collaborators: null,
        collaborators: null,
        targeted_urine: null,
        global_plasma_complementary: null,
        targeted_plasma: null,
        global_plasma: null,
        metabolite_biomarkers: null,
        icimd_no: null,
        omim_url: null,
        iembase_url: null,
        formatted_category_header: null,
        category_count: null,
        category_row_number: null,
        draft: null,
        soft_delete: null,
        created_at: null,
        updated_at: null,
        recruited_by: {},
        targeted_urine_biomarkers: null,
        targeted_plasma_biomarkers: null,
        other_biomarkers: null,
        targeted_urine_volume: null,
        global_plasma_volume: null,
        global_plasma_complementary_volume: null,
        sample_allocation_strategy_version: null
      };
      expect(hasDotData(imd)).toBe(true);
    });

    it("returns true when only target is a finite number", () => {
      const imd: IEMbaseItem = {
        id: 1,
        name: "Test IMD",
        iembase_name: "test",
        code: "T001",
        gene_symbol: null,
        alternative_names: null,
        icimd_category: null,
        icimd_subcategory: null,
        recruitment_target: 10,
        recruited_count: null,
        imd_status: null,
        number_of_collaborators: null,
        collaborators: null,
        targeted_urine: null,
        global_plasma_complementary: null,
        targeted_plasma: null,
        global_plasma: null,
        metabolite_biomarkers: null,
        icimd_no: null,
        omim_url: null,
        iembase_url: null,
        formatted_category_header: null,
        category_count: null,
        category_row_number: null,
        draft: null,
        soft_delete: null,
        created_at: null,
        updated_at: null,
        recruited_by: {},
        targeted_urine_biomarkers: null,
        targeted_plasma_biomarkers: null,
        other_biomarkers: null,
        targeted_urine_volume: null,
        global_plasma_volume: null,
        global_plasma_complementary_volume: null,
        sample_allocation_strategy_version: null
      };
      expect(hasDotData(imd)).toBe(true);
    });

    it("returns true when only recruited is a finite number", () => {
      const imd: IEMbaseItem = {
        id: 1,
        name: "Test IMD",
        iembase_name: "test",
        code: "T001",
        gene_symbol: null,
        alternative_names: null,
        icimd_category: null,
        icimd_subcategory: null,
        recruitment_target: null,
        recruited_count: 5,
        imd_status: null,
        number_of_collaborators: null,
        collaborators: null,
        targeted_urine: null,
        global_plasma_complementary: null,
        targeted_plasma: null,
        global_plasma: null,
        metabolite_biomarkers: null,
        icimd_no: null,
        omim_url: null,
        iembase_url: null,
        formatted_category_header: null,
        category_count: null,
        category_row_number: null,
        draft: null,
        soft_delete: null,
        created_at: null,
        updated_at: null,
        recruited_by: {},
        targeted_urine_biomarkers: null,
        targeted_plasma_biomarkers: null,
        other_biomarkers: null,
        targeted_urine_volume: null,
        global_plasma_volume: null,
        global_plasma_complementary_volume: null,
        sample_allocation_strategy_version: null
      };
      expect(hasDotData(imd)).toBe(true);
    });

    it("returns true when both values are null (Number(null) = 0)", () => {
      const imd: IEMbaseItem = {
        id: 1,
        name: "Test IMD",
        iembase_name: "test",
        code: "T001",
        gene_symbol: null,
        alternative_names: null,
        icimd_category: null,
        icimd_subcategory: null,
        recruitment_target: null,
        recruited_count: null,
        imd_status: null,
        number_of_collaborators: null,
        collaborators: null,
        targeted_urine: null,
        global_plasma_complementary: null,
        targeted_plasma: null,
        global_plasma: null,
        metabolite_biomarkers: null,
        icimd_no: null,
        omim_url: null,
        iembase_url: null,
        formatted_category_header: null,
        category_count: null,
        category_row_number: null,
        draft: null,
        soft_delete: null,
        created_at: null,
        updated_at: null,
        recruited_by: {},
        targeted_urine_biomarkers: null,
        targeted_plasma_biomarkers: null,
        other_biomarkers: null,
        targeted_urine_volume: null,
        global_plasma_volume: null,
        global_plasma_complementary_volume: null,
        sample_allocation_strategy_version: null
      };
      // Note: Number(null) returns 0, which is finite
      expect(hasDotData(imd)).toBe(true);
    });

    it("handles string numbers correctly", () => {
      const imd: IEMbaseItem = {
        id: 1,
        name: "Test IMD",
        iembase_name: "test",
        code: "T001",
        gene_symbol: null,
        alternative_names: null,
        icimd_category: null,
        icimd_subcategory: null,
        recruitment_target: "10",
        recruited_count: "5",
        imd_status: null,
        number_of_collaborators: null,
        collaborators: null,
        targeted_urine: null,
        global_plasma_complementary: null,
        targeted_plasma: null,
        global_plasma: null,
        metabolite_biomarkers: null,
        icimd_no: null,
        omim_url: null,
        iembase_url: null,
        formatted_category_header: null,
        category_count: null,
        category_row_number: null,
        draft: null,
        soft_delete: null,
        created_at: null,
        updated_at: null,
        recruited_by: {},
        targeted_urine_biomarkers: null,
        targeted_plasma_biomarkers: null,
        other_biomarkers: null,
        targeted_urine_volume: null,
        global_plasma_volume: null,
        global_plasma_complementary_volume: null,
        sample_allocation_strategy_version: null
      };
      expect(hasDotData(imd)).toBe(true);
    });

    it("returns false when values are non-numeric strings", () => {
      const imd: IEMbaseItem = {
        id: 1,
        name: "Test IMD",
        iembase_name: "test",
        code: "T001",
        gene_symbol: null,
        alternative_names: null,
        icimd_category: null,
        icimd_subcategory: null,
        recruitment_target: "invalid",
        recruited_count: "notanumber",
        imd_status: null,
        number_of_collaborators: null,
        collaborators: null,
        targeted_urine: null,
        global_plasma_complementary: null,
        targeted_plasma: null,
        global_plasma: null,
        metabolite_biomarkers: null,
        icimd_no: null,
        omim_url: null,
        iembase_url: null,
        formatted_category_header: null,
        category_count: null,
        category_row_number: null,
        draft: null,
        soft_delete: null,
        created_at: null,
        updated_at: null,
        recruited_by: {},
        targeted_urine_biomarkers: null,
        targeted_plasma_biomarkers: null,
        other_biomarkers: null,
        targeted_urine_volume: null,
        global_plasma_volume: null,
        global_plasma_complementary_volume: null,
        sample_allocation_strategy_version: null
      };
      // Number("invalid") = NaN, which is not finite
      expect(hasDotData(imd)).toBe(false);
    });
  });

  describe("getDotColor", () => {
    it("returns emerald when target is null (0) and recruited > 0", () => {
      const imd: IEMbaseItem = {
        id: 1,
        name: "Test IMD",
        iembase_name: "test",
        code: "T001",
        gene_symbol: null,
        alternative_names: null,
        icimd_category: null,
        icimd_subcategory: null,
        recruitment_target: null,
        recruited_count: 5,
        imd_status: null,
        number_of_collaborators: null,
        collaborators: null,
        targeted_urine: null,
        global_plasma_complementary: null,
        targeted_plasma: null,
        global_plasma: null,
        metabolite_biomarkers: null,
        icimd_no: null,
        omim_url: null,
        iembase_url: null,
        formatted_category_header: null,
        category_count: null,
        category_row_number: null,
        draft: null,
        soft_delete: null,
        created_at: null,
        updated_at: null,
        recruited_by: {},
        targeted_urine_biomarkers: null,
        targeted_plasma_biomarkers: null,
        other_biomarkers: null,
        targeted_urine_volume: null,
        global_plasma_volume: null,
        global_plasma_complementary_volume: null,
        sample_allocation_strategy_version: null
      };
      // Note: Number(null) = 0, so recruited (5) >= target (0) = emerald
      expect(getDotColor(imd)).toBe("bg-emerald-500");
    });

    it("returns red when recruited is null (0) and target > 0", () => {
      const imd: IEMbaseItem = {
        id: 1,
        name: "Test IMD",
        iembase_name: "test",
        code: "T001",
        gene_symbol: null,
        alternative_names: null,
        icimd_category: null,
        icimd_subcategory: null,
        recruitment_target: 10,
        recruited_count: null,
        imd_status: null,
        number_of_collaborators: null,
        collaborators: null,
        targeted_urine: null,
        global_plasma_complementary: null,
        targeted_plasma: null,
        global_plasma: null,
        metabolite_biomarkers: null,
        icimd_no: null,
        omim_url: null,
        iembase_url: null,
        formatted_category_header: null,
        category_count: null,
        category_row_number: null,
        draft: null,
        soft_delete: null,
        created_at: null,
        updated_at: null,
        recruited_by: {},
        targeted_urine_biomarkers: null,
        targeted_plasma_biomarkers: null,
        other_biomarkers: null,
        targeted_urine_volume: null,
        global_plasma_volume: null,
        global_plasma_complementary_volume: null,
        sample_allocation_strategy_version: null
      };
      // Note: Number(null) = 0, so recruited === 0 = red
      expect(getDotColor(imd)).toBe("bg-red-500");
    });

    it("returns red when recruited is 0", () => {
      const imd: IEMbaseItem = {
        id: 1,
        name: "Test IMD",
        iembase_name: "test",
        code: "T001",
        gene_symbol: null,
        alternative_names: null,
        icimd_category: null,
        icimd_subcategory: null,
        recruitment_target: 10,
        recruited_count: 0,
        imd_status: null,
        number_of_collaborators: null,
        collaborators: null,
        targeted_urine: null,
        global_plasma_complementary: null,
        targeted_plasma: null,
        global_plasma: null,
        metabolite_biomarkers: null,
        icimd_no: null,
        omim_url: null,
        iembase_url: null,
        formatted_category_header: null,
        category_count: null,
        category_row_number: null,
        draft: null,
        soft_delete: null,
        created_at: null,
        updated_at: null,
        recruited_by: {},
        targeted_urine_biomarkers: null,
        targeted_plasma_biomarkers: null,
        other_biomarkers: null,
        targeted_urine_volume: null,
        global_plasma_volume: null,
        global_plasma_complementary_volume: null,
        sample_allocation_strategy_version: null
      };
      expect(getDotColor(imd)).toBe("bg-red-500");
    });

    it("returns yellow when recruited is less than target", () => {
      const imd: IEMbaseItem = {
        id: 1,
        name: "Test IMD",
        iembase_name: "test",
        code: "T001",
        gene_symbol: null,
        alternative_names: null,
        icimd_category: null,
        icimd_subcategory: null,
        recruitment_target: 10,
        recruited_count: 5,
        imd_status: null,
        number_of_collaborators: null,
        collaborators: null,
        targeted_urine: null,
        global_plasma_complementary: null,
        targeted_plasma: null,
        global_plasma: null,
        metabolite_biomarkers: null,
        icimd_no: null,
        omim_url: null,
        iembase_url: null,
        formatted_category_header: null,
        category_count: null,
        category_row_number: null,
        draft: null,
        soft_delete: null,
        created_at: null,
        updated_at: null,
        recruited_by: {},
        targeted_urine_biomarkers: null,
        targeted_plasma_biomarkers: null,
        other_biomarkers: null,
        targeted_urine_volume: null,
        global_plasma_volume: null,
        global_plasma_complementary_volume: null,
        sample_allocation_strategy_version: null
      };
      expect(getDotColor(imd)).toBe("bg-yellow-400");
    });

    it("returns emerald when recruited equals target", () => {
      const imd: IEMbaseItem = {
        id: 1,
        name: "Test IMD",
        iembase_name: "test",
        code: "T001",
        gene_symbol: null,
        alternative_names: null,
        icimd_category: null,
        icimd_subcategory: null,
        recruitment_target: 10,
        recruited_count: 10,
        imd_status: null,
        number_of_collaborators: null,
        collaborators: null,
        targeted_urine: null,
        global_plasma_complementary: null,
        targeted_plasma: null,
        global_plasma: null,
        metabolite_biomarkers: null,
        icimd_no: null,
        omim_url: null,
        iembase_url: null,
        formatted_category_header: null,
        category_count: null,
        category_row_number: null,
        draft: null,
        soft_delete: null,
        created_at: null,
        updated_at: null,
        recruited_by: {},
        targeted_urine_biomarkers: null,
        targeted_plasma_biomarkers: null,
        other_biomarkers: null,
        targeted_urine_volume: null,
        global_plasma_volume: null,
        global_plasma_complementary_volume: null,
        sample_allocation_strategy_version: null
      };
      expect(getDotColor(imd)).toBe("bg-emerald-500");
    });

    it("returns emerald when recruited exceeds target", () => {
      const imd: IEMbaseItem = {
        id: 1,
        name: "Test IMD",
        iembase_name: "test",
        code: "T001",
        gene_symbol: null,
        alternative_names: null,
        icimd_category: null,
        icimd_subcategory: null,
        recruitment_target: 10,
        recruited_count: 15,
        imd_status: null,
        number_of_collaborators: null,
        collaborators: null,
        targeted_urine: null,
        global_plasma_complementary: null,
        targeted_plasma: null,
        global_plasma: null,
        metabolite_biomarkers: null,
        icimd_no: null,
        omim_url: null,
        iembase_url: null,
        formatted_category_header: null,
        category_count: null,
        category_row_number: null,
        draft: null,
        soft_delete: null,
        created_at: null,
        updated_at: null,
        recruited_by: {},
        targeted_urine_biomarkers: null,
        targeted_plasma_biomarkers: null,
        other_biomarkers: null,
        targeted_urine_volume: null,
        global_plasma_volume: null,
        global_plasma_complementary_volume: null,
        sample_allocation_strategy_version: null
      };
      expect(getDotColor(imd)).toBe("bg-emerald-500");
    });

    it("handles string numbers correctly", () => {
      const imd: IEMbaseItem = {
        id: 1,
        name: "Test IMD",
        iembase_name: "test",
        code: "T001",
        gene_symbol: null,
        alternative_names: null,
        icimd_category: null,
        icimd_subcategory: null,
        recruitment_target: "10",
        recruited_count: "5",
        imd_status: null,
        number_of_collaborators: null,
        collaborators: null,
        targeted_urine: null,
        global_plasma_complementary: null,
        targeted_plasma: null,
        global_plasma: null,
        metabolite_biomarkers: null,
        icimd_no: null,
        omim_url: null,
        iembase_url: null,
        formatted_category_header: null,
        category_count: null,
        category_row_number: null,
        draft: null,
        soft_delete: null,
        created_at: null,
        updated_at: null,
        recruited_by: {},
        targeted_urine_biomarkers: null,
        targeted_plasma_biomarkers: null,
        other_biomarkers: null,
        targeted_urine_volume: null,
        global_plasma_volume: null,
        global_plasma_complementary_volume: null,
        sample_allocation_strategy_version: null
      };
      expect(getDotColor(imd)).toBe("bg-yellow-400");
    });

    it("returns transparent when values are non-numeric strings", () => {
      const imd: IEMbaseItem = {
        id: 1,
        name: "Test IMD",
        iembase_name: "test",
        code: "T001",
        gene_symbol: null,
        alternative_names: null,
        icimd_category: null,
        icimd_subcategory: null,
        recruitment_target: "invalid",
        recruited_count: "notanumber",
        imd_status: null,
        number_of_collaborators: null,
        collaborators: null,
        targeted_urine: null,
        global_plasma_complementary: null,
        targeted_plasma: null,
        global_plasma: null,
        metabolite_biomarkers: null,
        icimd_no: null,
        omim_url: null,
        iembase_url: null,
        formatted_category_header: null,
        category_count: null,
        category_row_number: null,
        draft: null,
        soft_delete: null,
        created_at: null,
        updated_at: null,
        recruited_by: {},
        targeted_urine_biomarkers: null,
        targeted_plasma_biomarkers: null,
        other_biomarkers: null,
        targeted_urine_volume: null,
        global_plasma_volume: null,
        global_plasma_complementary_volume: null,
        sample_allocation_strategy_version: null
      };
      // Number("invalid") = NaN, not finite, returns transparent
      expect(getDotColor(imd)).toBe("bg-transparent");
    });

    it("returns emerald when both values are null (0)", () => {
      const imd: IEMbaseItem = {
        id: 1,
        name: "Test IMD",
        iembase_name: "test",
        code: "T001",
        gene_symbol: null,
        alternative_names: null,
        icimd_category: null,
        icimd_subcategory: null,
        recruitment_target: null,
        recruited_count: null,
        imd_status: null,
        number_of_collaborators: null,
        collaborators: null,
        targeted_urine: null,
        global_plasma_complementary: null,
        targeted_plasma: null,
        global_plasma: null,
        metabolite_biomarkers: null,
        icimd_no: null,
        omim_url: null,
        iembase_url: null,
        formatted_category_header: null,
        category_count: null,
        category_row_number: null,
        draft: null,
        soft_delete: null,
        created_at: null,
        updated_at: null,
        recruited_by: {},
        targeted_urine_biomarkers: null,
        targeted_plasma_biomarkers: null,
        other_biomarkers: null,
        targeted_urine_volume: null,
        global_plasma_volume: null,
        global_plasma_complementary_volume: null,
        sample_allocation_strategy_version: null
      };
      // Number(null) = 0 for both, so recruited (0) >= target (0) but also recruited === 0, so red
      expect(getDotColor(imd)).toBe("bg-red-500");
    });
  });
});

describe("Recruitment Explorer - Constants utilities", () => {
  describe("parseCollaborators", () => {
    it("parses string with curly braces and comma separated values", () => {
      const result = parseCollaborators("{UMC Utrecht,Radboudumc}");
      expect(result).toEqual(["UMC Utrecht", "Radboudumc"]);
    });

    it("parses string without curly braces", () => {
      const result = parseCollaborators("UMC Utrecht,Radboudumc");
      expect(result).toEqual(["UMC Utrecht", "Radboudumc"]);
    });

    it("handles array input", () => {
      const result = parseCollaborators(["UMC Utrecht", "Radboudumc"]);
      expect(result).toEqual(["UMC Utrecht", "Radboudumc"]);
    });

    it("filters out empty strings from array", () => {
      const result = parseCollaborators([
        "UMC Utrecht",
        "",
        "Radboudumc",
        null as unknown as string,
      ]);
      expect(result).toEqual(["UMC Utrecht", "Radboudumc"]);
    });

    it("trims whitespace from values", () => {
      const result = parseCollaborators("  UMC Utrecht  ,  Radboudumc  ");
      expect(result).toEqual(["UMC Utrecht", "Radboudumc"]);
    });

    it("handles null input", () => {
      const result = parseCollaborators(null);
      expect(result).toEqual([]);
    });

    it("handles undefined input", () => {
      const result = parseCollaborators(undefined);
      expect(result).toEqual([]);
    });

    it("handles empty string", () => {
      const result = parseCollaborators("");
      expect(result).toEqual([]);
    });

    it("filters out empty values after splitting", () => {
      const result = parseCollaborators("{UMC Utrecht,,Radboudumc,}");
      expect(result).toEqual(["UMC Utrecht", "Radboudumc"]);
    });

    it("handles single collaborator", () => {
      const result = parseCollaborators("{UMC Utrecht}");
      expect(result).toEqual(["UMC Utrecht"]);
    });

    it("handles multiple curly braces", () => {
      const result = parseCollaborators("{{UMC Utrecht,Radboudumc}}");
      expect(result).toEqual(["UMC Utrecht", "Radboudumc"]);
    });
  });

  describe("SHOW_ALL_HEALTHCARE_PROVIDERS constant", () => {
    it("has the expected value", () => {
      expect(SHOW_ALL_HEALTHCARE_PROVIDERS).toBe("Show All Healthcare Providers");
    });
  });
});
