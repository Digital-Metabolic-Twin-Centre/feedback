import {
  baseBiospecimenSchema,
  biospecimenFormSchema,
  getBiospecimenSchema,
} from "@/app/ecrfs/biospecimen/logs/validation/schema";

describe("Biospecimen Schema", () => {
  describe("baseBiospecimenSchema", () => {
    it("validates minimal valid biospecimen data", () => {
      const validData = {
        specimen_type: [1, 2],
      };

      const result = baseBiospecimenSchema.parse(validData);
      expect(result.specimen_type).toEqual([1, 2]);
    });

    it("requires at least one specimen_type", () => {
      expect(() =>
        baseBiospecimenSchema.parse({
          specimen_type: [],
        })
      ).toThrow("You must select at least one specimen type");
    });

    it("validates specimen_type is an array of numbers", () => {
      const result = baseBiospecimenSchema.parse({
        specimen_type: [1, 2, 3],
      });

      expect(result.specimen_type).toEqual([1, 2, 3]);
    });

    it("handles optional weight field", () => {
      const result = baseBiospecimenSchema.parse({
        specimen_type: [1],
        weight: 150.5,
      });

      expect(result.weight).toBe(150.5);
    });

    it("validates weight must be greater than 0", () => {
      expect(() =>
        baseBiospecimenSchema.parse({
          specimen_type: [1],
          weight: 0,
        })
      ).toThrow();

      expect(() =>
        baseBiospecimenSchema.parse({
          specimen_type: [1],
          weight: -10,
        })
      ).toThrow();
    });

    it("accepts null weight", () => {
      const result = baseBiospecimenSchema.parse({
        specimen_type: [1],
        weight: null,
      });

      expect(result.weight).toBeNull();
    });

    it("validates total_volume_of_draw must be greater than 0", () => {
      expect(() =>
        baseBiospecimenSchema.parse({
          specimen_type: [1],
          total_volume_of_draw: 0,
        })
      ).toThrow();

      expect(() =>
        baseBiospecimenSchema.parse({
          specimen_type: [1],
          total_volume_of_draw: -5,
        })
      ).toThrow();
    });

    it("accepts valid total_volume_of_draw", () => {
      const result = baseBiospecimenSchema.parse({
        specimen_type: [1],
        total_volume_of_draw: 10.5,
      });

      expect(result.total_volume_of_draw).toBe(10.5);
    });

    it("handles boolean fields with default false", () => {
      const result = baseBiospecimenSchema.parse({
        specimen_type: [1],
        urine_was_collected: null,
        specimen_centrifuged: undefined,
        transferred_into_cryovials: false,
      });

      expect(result.urine_was_collected).toBe(false);
      expect(result.specimen_centrifuged).toBe(false);
      expect(result.transferred_into_cryovials).toBe(false);
    });

    it("preserves true boolean values", () => {
      const result = baseBiospecimenSchema.parse({
        specimen_type: [1],
        urine_was_collected: true,
        specimen_centrifuged: true,
      });

      expect(result.urine_was_collected).toBe(true);
      expect(result.specimen_centrifuged).toBe(true);
    });

    it("handles date preprocessing for urine collection", () => {
      const date = new Date("2023-06-15T10:30:00Z");
      const result = baseBiospecimenSchema.parse({
        specimen_type: [1],
        date_time_of_urine_collection: date,
      });

      expect(result.date_time_of_urine_collection).toEqual(date);
    });

    it("accepts null for optional date fields", () => {
      const result = baseBiospecimenSchema.parse({
        specimen_type: [1],
        date_time_of_urine_collection: null,
        date_of_biopsy: null,
      });

      expect(result.date_time_of_urine_collection).toBeNull();
      expect(result.date_of_biopsy).toBeNull();
    });

    it("converts string dates to Date objects", () => {
      const result = baseBiospecimenSchema.parse({
        specimen_type: [1],
        date_time_of_edta_plasma_collection: "2023-06-15T10:00:00Z",
      });

      expect(result.date_time_of_edta_plasma_collection).toBeInstanceOf(Date);
    });

    it("handles empty string as null for dates", () => {
      const result = baseBiospecimenSchema.parse({
        specimen_type: [1],
        date_time_of_urine_collection: "",
      });

      expect(result.date_time_of_urine_collection).toBeNull();
    });

    it("validates decimal volume fields", () => {
      const result = baseBiospecimenSchema.parse({
        specimen_type: [1],
        urine_aliquots_volume_one: 5.25,
        urine_aliquots_volume_two: 3.5,
        urine_aliquots_volume_three: 10.0,
      });

      expect(result.urine_aliquots_volume_one).toBe(5.25);
      expect(result.urine_aliquots_volume_two).toBe(3.5);
      expect(result.urine_aliquots_volume_three).toBe(10.0);
    });

    it("rejects volume less than or equal to 0.01", () => {
      expect(() =>
        baseBiospecimenSchema.parse({
          specimen_type: [1],
          urine_aliquots_volume_one: 0.01,
        })
      ).toThrow();

      expect(() =>
        baseBiospecimenSchema.parse({
          specimen_type: [1],
          plasma_aliquots_volume_one: 0.005,
        })
      ).toThrow();
    });

    it("accepts null for decimal volume fields", () => {
      const result = baseBiospecimenSchema.parse({
        specimen_type: [1],
        urine_aliquots_volume_one: null,
        plasma_aliquots_volume_two: null,
      });

      expect(result.urine_aliquots_volume_one).toBeNull();
      expect(result.plasma_aliquots_volume_two).toBeNull();
    });

    it("converts string decimals to numbers", () => {
      const result = baseBiospecimenSchema.parse({
        specimen_type: [1],
        urine_aliquots_volume_one: "5.5",
        plasma_aliquots_volume_one: "10.25",
      });

      expect(result.urine_aliquots_volume_one).toBe(5.5);
      expect(result.plasma_aliquots_volume_one).toBe(10.25);
    });

    it("handles empty string as null for volumes", () => {
      const result = baseBiospecimenSchema.parse({
        specimen_type: [1],
        urine_aliquots_volume_one: "",
        frozen_pellets_aliquots_volume_two: "",
      });

      expect(result.urine_aliquots_volume_one).toBeNull();
      expect(result.frozen_pellets_aliquots_volume_two).toBeNull();
    });

    it("handles all EDTA plasma collection fields", () => {
      const result = baseBiospecimenSchema.parse({
        specimen_type: [1],
        edta_plasma_was_collected: true,
        edta_plasma_reason_not_collected: "Sample contaminated",
        edta_blood_tube: true,
        edta_plasma_specimen_centrifuged: true,
        edta_plasma_transferred_into_cryovials: true,
        plasma_aliquots_collected: 3,
      });

      expect(result.edta_plasma_was_collected).toBe(true);
      expect(result.edta_plasma_reason_not_collected).toBe("Sample contaminated");
      expect(result.plasma_aliquots_collected).toBe(3);
    });

    it("handles all EDTA blood fields", () => {
      const result = baseBiospecimenSchema.parse({
        specimen_type: [1],
        edta_blood_was_collected: true,
        edta_blood_reason_not_collected: null,
        edta_blood_sample_stored: 1,
        edta_blood_additional_deviations: false,
      });

      expect(result.edta_blood_was_collected).toBe(true);
      expect(result.edta_blood_sample_stored).toBe(1);
    });

    it("handles PAX-gene RNA fields", () => {
      const result = baseBiospecimenSchema.parse({
        specimen_type: [1],
        pax_gene_rna_was_collected: true,
        pax_gene_rna_sample_stored: 2,
        pax_gene_additional_deviations: false,
      });

      expect(result.pax_gene_rna_was_collected).toBe(true);
      expect(result.pax_gene_rna_sample_stored).toBe(2);
    });

    it("handles fibroblasts section fields", () => {
      const result = baseBiospecimenSchema.parse({
        specimen_type: [1],
        date_of_biopsy: new Date("2023-05-10"),
        biopsy_procedure: true,
        adverse_event_report: false,
        anatomical_origin_of_tissue: "Skin",
        specifics_of_cell_line: "Primary fibroblasts",
        cell_line_passage_number: 5,
      });

      expect(result.biopsy_procedure).toBe(true);
      expect(result.anatomical_origin_of_tissue).toBe("Skin");
      expect(result.cell_line_passage_number).toBe(5);
    });

    it("handles frozen cell pellets fields", () => {
      const result = baseBiospecimenSchema.parse({
        specimen_type: [1],
        percentage_of_cell_confluence: 85,
        frozen_pellets_aliquots_collected: 4,
        frozen_pellets_aliquots_volume_one: 1.5,
        tested_for_mycoplasma: true,
        outcome_of_testing: 1,
      });

      expect(result.percentage_of_cell_confluence).toBe(85);
      expect(result.frozen_pellets_aliquots_collected).toBe(4);
      expect(result.tested_for_mycoplasma).toBe(true);
    });

    it("handles living cell culture fields", () => {
      const result = baseBiospecimenSchema.parse({
        specimen_type: [1],
        living_cell_confluence: 90,
        cell_number_plated: 1000000,
        comment_culture_medium: "DMEM with 10% FBS",
        living_tested_for_mycoplasma: true,
      });

      expect(result.living_cell_confluence).toBe(90);
      expect(result.cell_number_plated).toBe(1000000);
      expect(result.comment_culture_medium).toBe("DMEM with 10% FBS");
    });

    it("handles frozen cryo stocks fields", () => {
      const result = baseBiospecimenSchema.parse({
        specimen_type: [1],
        frozen_cell_confluence: 95,
        frozen_cryo_aliquots_collected: 6,
        frozen_cryo_aliquots_volume_one: 2.0,
        comment_cryopreservant: "10% DMSO",
        cryo_tested_for_mycoplasma: false,
      });

      expect(result.frozen_cell_confluence).toBe(95);
      expect(result.frozen_cryo_aliquots_collected).toBe(6);
      expect(result.comment_cryopreservant).toBe("10% DMSO");
    });

    it("handles stool collection fields", () => {
      const result = baseBiospecimenSchema.parse({
        specimen_type: [1],
        date_time_of_stool_collection: new Date("2023-06-20"),
        stool_sample_collection_comment: "Sample collected at home",
      });

      expect(result.date_time_of_stool_collection).toBeInstanceOf(Date);
      expect(result.stool_sample_collection_comment).toBe("Sample collected at home");
    });

    it("handles draft and audit fields", () => {
      const result = baseBiospecimenSchema.parse({
        specimen_type: [1],
        draft: true,
        soft_delete: false,
        created_by: "lab@example.com",
        created_at: "2023-01-01T00:00:00Z",
        updated_by: "admin@example.com",
        updated_at: "2023-06-01T00:00:00Z",
      });

      expect(result.draft).toBe(true);
      expect(result.soft_delete).toBe(false);
      expect(result.created_by).toBe("lab@example.com");
    });

    it("handles optional id and visit_id", () => {
      const result = baseBiospecimenSchema.parse({
        specimen_type: [1],
        id: 123,
        biospecimen_id: "BIO-001",
        visit_id: 456,
      });

      expect(result.id).toBe(123);
      expect(result.biospecimen_id).toBe("BIO-001");
      expect(result.visit_id).toBe(456);
    });

    it("handles comment fields", () => {
      const result = baseBiospecimenSchema.parse({
        specimen_type: [1],
        urine_comment: "Sample appears cloudy",
        specimen_placed_comment: "Placed immediately on ice",
        freezer_storage_comment: "Stored at -80°C",
      });

      expect(result.urine_comment).toBe("Sample appears cloudy");
      expect(result.specimen_placed_comment).toBe("Placed immediately on ice");
    });

    it("handles numeric identifier fields", () => {
      const result = baseBiospecimenSchema.parse({
        specimen_type: [1],
        mode_of_urine_collection: 1,
        urine_specimen_placed: 2,
        urine_incubation_time_room_temp: 15,
        incubation_time_two_to_eight: 30,
        urine_aliquots_collected: 3,
      });

      expect(result.mode_of_urine_collection).toBe(1);
      expect(result.urine_incubation_time_room_temp).toBe(15);
      expect(result.urine_aliquots_collected).toBe(3);
    });
  });

  describe("getBiospecimenSchema", () => {
    it("allows draft to bypass validation", () => {
      const schema = getBiospecimenSchema([]);
      const result = schema.parse({
        specimen_type: [1],
        draft: true,
      });

      expect(result.draft).toBe(true);
    });

    it("validates non-draft data", () => {
      const schema = getBiospecimenSchema([]);
      const result = schema.parse({
        specimen_type: [1],
        draft: false,
      });

      expect(result.draft).toBe(false);
    });
  });

  describe("biospecimenFormSchema", () => {
    it("is equivalent to baseBiospecimenSchema", () => {
      const validData = {
        specimen_type: [1, 2],
        weight: 150,
        urine_was_collected: true,
      };

      const result = biospecimenFormSchema.parse(validData);
      expect(result).toMatchObject(validData);
    });
  });

  describe("Edge cases", () => {
    it("handles invalid date strings", () => {
      expect(() =>
        baseBiospecimenSchema.parse({
          specimen_type: [1],
          date_time_of_urine_collection: "invalid-date",
        })
      ).not.toThrow(); // Should convert to null
    });

    it("handles multiple specimen types", () => {
      const result = baseBiospecimenSchema.parse({
        specimen_type: [1, 2, 3, 4, 5],
      });

      expect(result.specimen_type).toEqual([1, 2, 3, 4, 5]);
    });

    it("rejects non-numeric specimen types", () => {
      expect(() =>
        baseBiospecimenSchema.parse({
          specimen_type: ["invalid"],
        })
      ).toThrow();
    });
  });
});
