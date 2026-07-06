import { describe, expect, it } from "vitest";
import { volunteerProfileDetailsSchema } from "../src/features/volunteers/lib/profile-details";

describe("volunteer profile details", () => {
  it("trims profile details and defaults missing fields", () => {
    const result = volunteerProfileDetailsSchema.parse({
      batchYear: "  2024  ",
      department: "  Computer Science  ",
      faculty: "  Engineering  ",
      headline: "  Event volunteer  ",
      universityIndex: "  240000A  ",
    });

    expect(result).toEqual({
      batchYear: "2024",
      bio: "",
      department: "Computer Science",
      faculty: "Engineering",
      headline: "Event volunteer",
      linkedinUrl: "",
      skills: "",
      universityIndex: "240000A",
    });
  });

  it("requires LinkedIn URLs when a URL is provided", () => {
    expect(() =>
      volunteerProfileDetailsSchema.parse({
        batchYear: "2024",
        department: "Computer Science",
        faculty: "Engineering",
        linkedinUrl: "http://linkedin.com/in/test",
        universityIndex: "240000A",
      }),
    ).toThrow("linkedin.com");

    expect(() =>
      volunteerProfileDetailsSchema.parse({
        batchYear: "2024",
        department: "Computer Science",
        faculty: "Engineering",
        linkedinUrl: "https://example.com/in/test",
        universityIndex: "240000A",
      }),
    ).toThrow("linkedin.com");

    expect(
      volunteerProfileDetailsSchema.parse({
        batchYear: "2024",
        department: "Computer Science",
        faculty: "Engineering",
        linkedinUrl: "https://www.linkedin.com/in/test",
        universityIndex: "240000A",
      }).linkedinUrl,
    ).toBe("https://www.linkedin.com/in/test");
  });

  it("requires academic identity fields", () => {
    expect(() =>
      volunteerProfileDetailsSchema.parse({
        batchYear: "",
        department: "Computer Science",
        faculty: "Engineering",
        universityIndex: "240000A",
      }),
    ).toThrow("Batch/year");
  });

  it("validates university index formats", () => {
    // Valid 6 digits + letter
    expect(
      volunteerProfileDetailsSchema.parse({
        batchYear: "2024",
        department: "Computer Science",
        faculty: "Engineering",
        universityIndex: "245013Z",
      }).universityIndex
    ).toBe("245013Z");

    // Valid 5 digits + letter (special case from prompt)
    expect(
      volunteerProfileDetailsSchema.parse({
        batchYear: "2024",
        department: "Computer Science",
        faculty: "Engineering",
        universityIndex: "24317B",
      }).universityIndex
    ).toBe("24317B");

    // Invalid: missing letter
    expect(() =>
      volunteerProfileDetailsSchema.parse({
        batchYear: "2024",
        department: "Computer Science",
        faculty: "Engineering",
        universityIndex: "245013",
      })
    ).toThrow("University index must be 5-6 digits followed by an English letter");

    // Invalid: too many digits
    expect(() =>
      volunteerProfileDetailsSchema.parse({
        batchYear: "2024",
        department: "Computer Science",
        faculty: "Engineering",
        universityIndex: "2450134A",
      })
    ).toThrow("University index must be 5-6 digits followed by an English letter");

    // Invalid: mismatched batch year
    expect(() =>
      volunteerProfileDetailsSchema.parse({
        batchYear: "2024",
        department: "Computer Science",
        faculty: "Engineering",
        universityIndex: "233317M",
      })
    ).toThrow("University index must start with the selected batch digits");
  });
});
