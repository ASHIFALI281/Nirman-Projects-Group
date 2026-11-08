import re
from copy import copy
from datetime import date
from typing import Annotated, Any, Literal, Optional

from pydantic import AfterValidator, BaseModel, BeforeValidator, ConfigDict, EmailStr, Field, create_model, field_validator, model_validator
from pydantic.fields import FieldInfo

from core import BaseDocument, PyObjectId


def _phone(v: str) -> str:
    if not 7 <= len(re.sub(r"\D", "", v)) <= 15:
        raise ValueError("Enter a valid phone number (7-15 digits)")
    if not re.fullmatch(r"[0-9+\-\s()]+", v):
        raise ValueError("Phone number may only contain digits, spaces, +, - and brackets")
    return v


def _iso_date(v: str) -> str:
    date.fromisoformat(v)
    return v


Phone = Annotated[str, Field(max_length=20), AfterValidator(_phone)]


def _mobile(v: str) -> str:
    digits = re.sub(r"\D", "", v)
    if not re.fullmatch(r"[0-9+\-\s()]+", v) or not 10 <= len(digits) <= 15:
        raise ValueError("Enter a valid mobile number (10 digits, country code optional)")
    if len(digits) == 10 and digits[0] not in "6789":
        raise ValueError("Enter a valid 10-digit mobile number")
    return v


Mobile = Annotated[str, Field(max_length=20), AfterValidator(_mobile)]
ISODate = Annotated[str, AfterValidator(_iso_date)]
OptEmail = Annotated[Optional[EmailStr], BeforeValidator(lambda v: v or None)]
Name = Annotated[str, Field(min_length=2, max_length=100)]
Slug = Annotated[str, Field(pattern=r"^[a-z0-9-]{2,60}$")]
Short = Annotated[str, Field(max_length=200)]
ContentKey = Annotated[str, Field(pattern=r"^[a-z0-9_.-]{2,80}$")]


_BLOCK = re.compile(r"<(script|style)\b[^>]*>.*?(</\1\s*>|$)", re.I | re.S)
_TAG = re.compile(r"</?[a-zA-Z!][^>]*>")
_CTRL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_RAW_FIELDS = {"password", "current_password", "new_password"}


def clean_text(v):
    if isinstance(v, str):
        return _CTRL.sub("", _TAG.sub("", _BLOCK.sub("", v))).strip()
    if isinstance(v, list):
        return [clean_text(x) for x in v]
    return v


class In(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    @field_validator("*", mode="before")
    @classmethod
    def _sanitize(cls, v, info):
        return v if info.field_name in _RAW_FIELDS else clean_text(v)


def _optional_field(f: FieldInfo) -> FieldInfo:
    fi = copy(f)
    fi.default = None
    fi.default_factory = None
    return fi


def partial(model: type[BaseModel], name: str) -> type[BaseModel]:
    fields = {n: (Optional[f.annotation], _optional_field(f)) for n, f in model.model_fields.items()}
    return create_model(name, __base__=In, **fields)


# Company information (single document)
class ManagerIn(In):
    name: Name
    role: Annotated[str, Field(min_length=2, max_length=100)]
    about: str = Field("", max_length=500)
    photo_url: str = Field("", max_length=500)


class CompanyIn(In):
    name: str = Field(min_length=2, max_length=150)
    tagline: str = Field("", max_length=300)
    phone: str = Field("", max_length=50)
    email: str = Field("", max_length=150)
    whatsapp: str = Field("", max_length=50)
    address: str = Field("", max_length=500)
    working_hours: str = Field("", max_length=150)
    gst_number: str = Field("", max_length=50)
    founded_year: str = Field("", max_length=10)
    about: str = Field("", max_length=3000)
    vision: str = Field("", max_length=1000)
    mission: str = Field("", max_length=1000)
    management: list[ManagerIn] = Field(default_factory=list, max_length=20)
    social_links: dict[str, Annotated[str, Field(max_length=300)]] = Field(default_factory=dict)


class CompanyInfo(BaseDocument, CompanyIn):
    pass


CompanyUpdate = partial(CompanyIn, "CompanyUpdate")


# Services
class ServiceIn(In):
    slug: Slug
    title_en: str = Field(min_length=2, max_length=150)
    title_hi: str = Field("", max_length=150)
    short_en: str = Field("", max_length=300)
    short_hi: str = Field("", max_length=300)
    description: str = Field("", max_length=3000)
    details: str = Field("", max_length=3000)
    points: list[Short] = Field(default_factory=list, max_length=20)
    image_url: str = Field("", max_length=500)
    order: int = Field(0, ge=0, le=1000)
    active: bool = True


class Service(BaseDocument, ServiceIn):
    pass


ServiceUpdate = partial(ServiceIn, "ServiceUpdate")


# Projects
class ProjectIn(In):
    name: str = Field(min_length=2, max_length=200)
    location: str = Field("", max_length=200)
    category: str = Field(min_length=2, max_length=150)
    description: str = Field("", max_length=5000)
    status: Literal["ongoing", "completed"]
    start_date: Optional[ISODate] = None
    completion_date: Optional[ISODate] = None
    images: list[Annotated[str, Field(max_length=500)]] = Field(default_factory=list, max_length=30)
    featured: bool = False
    published: bool = True
    order: int = Field(0, ge=0, le=1000)

    @model_validator(mode="after")
    def check_dates(self):
        if self.start_date and self.completion_date and self.completion_date < self.start_date:
            raise ValueError("Completion date cannot be before start date")
        return self


class Project(BaseDocument, ProjectIn):
    pass


ProjectUpdate = partial(ProjectIn, "ProjectUpdate")


# Clients
class ClientIn(In):
    name: str = Field(min_length=2, max_length=200)
    company_name: str = Field("", max_length=200)
    sector: str = Field("", max_length=100)
    description: str = Field("", max_length=2000)
    logo_url: str = Field("", max_length=500)
    website: str = Field("", max_length=300)
    contact_person: str = Field("", max_length=100)
    phone: str = Field("", max_length=50)
    email: OptEmail = None
    notes: str = Field("", max_length=3000)
    show_on_website: bool = False
    order: int = Field(0, ge=0, le=1000)


class Client(BaseDocument, ClientIn):
    pass


class ClientPublic(BaseModel):
    id: PyObjectId
    name: str
    company_name: str
    sector: str
    description: str
    logo_url: str
    website: str


ClientUpdate = partial(ClientIn, "ClientUpdate")


# Careers (job openings)
class JobIn(In):
    title: str = Field(min_length=2, max_length=150)
    department: str = Field("", max_length=100)
    location: str = Field("", max_length=150)
    employment_type: str = Field("Full-time", max_length=50)
    experience: str = Field("", max_length=100)
    description: str = Field("", max_length=5000)
    requirements: list[Short] = Field(default_factory=list, max_length=30)
    is_open: bool = True
    order: int = Field(0, ge=0, le=1000)


class Job(BaseDocument, JobIn):
    pass


JobUpdate = partial(JobIn, "JobUpdate")


# Enquiries
class EnquiryIn(In):
    name: Name
    company_name: str = Field("", max_length=150)
    phone: Phone
    email: OptEmail = None
    service: Optional[Annotated[str, Field(max_length=100)]] = None
    location: str = Field("", max_length=200)
    budget: str = Field("", max_length=60)
    message: str = Field(min_length=5, max_length=3000)
    source: str = Field("website", max_length=50)


class EnquirySubmit(EnquiryIn):
    phone: Mobile
    location: str = Field(min_length=2, max_length=200)
    hp: str = Field("", max_length=200)
    client_token: Optional[Annotated[str, Field(max_length=64)]] = None


EnquiryStatus = Literal["new", "contacted", "in_progress", "completed"]


class Enquiry(BaseDocument, EnquiryIn):
    enquiry_no: str = ""
    status: EnquiryStatus = "new"
    admin_notes: str = ""
    email_status: str = "pending"
    email_error: str = ""


class EnquiryUpdate(In):
    status: Optional[EnquiryStatus] = None
    admin_notes: Optional[str] = Field(None, max_length=3000)


# Job applications
class ApplicationIn(In):
    job_id: Optional[Annotated[str, Field(max_length=50)]] = None
    position: str = Field(min_length=2, max_length=150)
    name: Name
    phone: Phone
    email: OptEmail = None
    message: str = Field("", max_length=3000)


ApplicationStatus = Literal["new", "reviewing", "shortlisted", "rejected"]


class ApplicationSubmit(ApplicationIn):
    hp: str = Field("", max_length=200)


class Application(BaseDocument, ApplicationIn):
    status: ApplicationStatus = "new"
    admin_notes: str = ""


class ApplicationUpdate(In):
    status: Optional[ApplicationStatus] = None
    admin_notes: Optional[str] = Field(None, max_length=3000)


# Website content blocks (key -> value)
class ContentIn(In):
    value: Any
    description: str = Field("", max_length=300)


class Content(BaseDocument):
    key: str
    value: Any = None
    description: str = ""


# Admin users
class AdminOut(BaseModel):
    id: PyObjectId
    email: str
    name: str
    role: str


class LoginIn(In):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class ChangePasswordIn(In):
    current_password: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=10, max_length=200)
